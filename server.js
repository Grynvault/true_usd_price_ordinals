const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const BITCOIN_PRICES = require('./bitcoin-data.js');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/data', express.static('data'));

// CORS for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Utility functions
function dayKey(date) {
    const d = new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function toDate(ts) {
    if (ts == null) return null;
    if (typeof ts === 'number') return new Date(ts > 1e12 ? ts : ts * 1000);
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
}

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

// Parse BestInSlot API response
function parseBestInSlotData(data) {
    let arr = Array.isArray(data) ? data : null;

    if (!arr) {
        // Find longest array in response
        let best = 0;
        for (const k of Object.keys(data)) {
            const v = data[k];
            if (Array.isArray(v) && v.length > best) {
                arr = v;
                best = v.length;
            }
        }
    }

    if (!arr?.length) throw new Error('No data found in API response');

    const points = [];
    for (const row of arr) {
        let timestamp = null, price = null;

        if (Array.isArray(row)) {
            timestamp = row[0];
            price = row[2] != null ? row[2] : row[1];
        } else if (typeof row === 'object' && row) {
            timestamp = row.timestamp ?? row.time ?? row.t ?? row.date ?? row.day;
            // For BestInSlot API, prioritize 'price' field over others
            price = row.price ?? row.value ?? row.close;
            if (price == null) {
                // Fallback: find first numeric field that's not timestamp/volume/id
                for (const k of Object.keys(row)) {
                    if (['id', 'timestamp', 'time', 't', 'date', 'day', 'volume', 'slug'].includes(k)) continue;
                    const num = Number(row[k]);
                    if (Number.isFinite(num)) {
                        price = num;
                        break;
                    }
                }
            }
        }

        const date = toDate(timestamp);
        if (!isNaN(date?.getTime()) && typeof price === 'number' && isFinite(price)) {
            const day = dayKey(date);
            points.push({ day, btc: price, date: date });
        }
    }

    // Keep last value per day
    const map = new Map();
    points.sort((a, b) => a.day.localeCompare(b.day))
          .forEach(p => map.set(p.day, p));

    return Array.from(map.values());
}

// Fetch CoinGecko data for gap filling
async function fetchCoinGeckoData(fromDay, toDay) {
    try {
        // Limit to recent dates only (last 300 days to stay within CoinGecko free limits)
        const maxDaysBack = 300;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxDaysBack);
        const cutoffDay = cutoffDate.getFullYear() + '-' + String(cutoffDate.getMonth() + 1).padStart(2, '0') + '-' + String(cutoffDate.getDate()).padStart(2, '0');

        // Use the later of fromDay or cutoffDay
        const actualFromDay = fromDay > cutoffDay ? fromDay : cutoffDay;

        console.log(`Fetching CoinGecko data for ${actualFromDay} to ${toDay} (limited to recent ${maxDaysBack} days)`);

        const fromUnix = Math.floor(new Date(actualFromDay + 'T00:00:00Z').getTime() / 1000);
        const toUnix = Math.floor(new Date(toDay + 'T23:59:59Z').getTime() / 1000);

        const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromUnix}&to=${toUnix}`;
        const data = await httpsGet(url);

        if (data.error) {
            console.error('CoinGecko API Error:', data.error.error_message || 'Unknown error');
            return new Map();
        }

        const map = new Map();
        (data.prices || []).forEach(([ts, price]) => {
            const d = new Date(ts);
            const dayKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            map.set(dayKey, price);
        });

        console.log(`Fetched ${map.size} CoinGecko prices`);
        return map;
    } catch (error) {
        console.error('CoinGecko fetch error:', error.message);
        return new Map();
    }
}

// Convert ordinal prices to USD
async function convertToUSD(ordinalData, useCoinGecko = false) {
    let coinGeckoData = new Map();

    if (useCoinGecko && ordinalData.length > 0) {
        const minDay = ordinalData[0].day;
        const maxDay = ordinalData[ordinalData.length - 1].day;
        coinGeckoData = await fetchCoinGeckoData(minDay, maxDay);
    }

    return ordinalData.map(point => {
        const btcPrice = BITCOIN_PRICES[point.day] ||
                        BITCOIN_PRICES[point.day.slice(0, 7)] ||
                        coinGeckoData.get(point.day) ||
                        null;

        return {
            ...point,
            btcPrice: btcPrice,
            usd: btcPrice ? point.btc * btcPrice : null
        };
    });
}

// API Routes

// Get collection data
app.get('/api/collection/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { useCoinGecko } = req.query;

        console.log(`Fetching data for collection: ${slug}`);

        // Fetch ordinal data from BestInSlot
        const bestInSlotUrl = `https://v2api.bestinslot.xyz/collection/chart?slug=${encodeURIComponent(slug)}`;
        const rawData = await httpsGet(bestInSlotUrl);

        // Parse and process data
        const ordinalData = parseBestInSlotData(rawData);
        const usdData = await convertToUSD(ordinalData, useCoinGecko === 'true');

        const validPoints = usdData.filter(p => p.usd != null);
        const missingPoints = usdData.length - validPoints.length;

        // Calculate statistics
        const usdValues = validPoints.map(p => p.usd);
        const stats = {
            totalPoints: validPoints.length,
            missingPoints: missingPoints,
            minUsd: usdValues.length ? Math.min(...usdValues) : 0,
            maxUsd: usdValues.length ? Math.max(...usdValues) : 0,
            avgUsd: usdValues.length ? usdValues.reduce((a, b) => a + b, 0) / usdValues.length : 0,
            dateRange: {
                start: ordinalData.length ? ordinalData[0].day : null,
                end: ordinalData.length ? ordinalData[ordinalData.length - 1].day : null
            }
        };

        res.json({
            success: true,
            slug: slug,
            data: usdData,
            stats: stats
        });

    } catch (error) {
        console.error(`Error fetching data for ${req.params.slug}:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get Bitcoin price data
app.get('/api/bitcoin-prices', (req, res) => {
    const { start, end } = req.query;

    let data = BITCOIN_PRICES;

    if (start || end) {
        data = {};
        for (const [date, price] of Object.entries(BITCOIN_PRICES)) {
            if (start && date < start) continue;
            if (end && date > end) continue;
            data[date] = price;
        }
    }

    res.json({
        success: true,
        data: data,
        count: Object.keys(data).length
    });
});

// Export CSV data
app.get('/api/collection/:slug/csv', async (req, res) => {
    try {
        const { slug } = req.params;

        // Get the data (reuse the collection endpoint logic)
        const bestInSlotUrl = `https://v2api.bestinslot.xyz/collection/chart?slug=${encodeURIComponent(slug)}`;
        const rawData = await httpsGet(bestInSlotUrl);
        const ordinalData = parseBestInSlotData(rawData);
        const usdData = await convertToUSD(ordinalData, true); // Use CoinGecko for CSV downloads

        // Generate CSV
        const csvRows = ['day,btc,usd,btc_usd_px'];
        usdData.forEach(p => {
            csvRows.push(`${p.day},${p.btc},${p.usd || ''},${p.btcPrice || ''}`);
        });

        const csvContent = csvRows.join('\\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${slug}_usd_timeseries.csv"`);
        res.send(csvContent);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'BestInSlot USD Tracker API is running',
        timestamp: new Date().toISOString(),
        bitcoinDataPoints: Object.keys(BITCOIN_PRICES).length
    });
});

// Serve main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 BestInSlot USD Tracker running at http://127.0.0.1:${PORT}`);
    console.log(`📊 Loaded ${Object.keys(BITCOIN_PRICES).length} Bitcoin price data points`);
    console.log(`🔗 API endpoints:`);
    console.log(`   GET /api/health`);
    console.log(`   GET /api/collection/:slug`);
    console.log(`   GET /api/collection/:slug/csv`);
    console.log(`   GET /api/bitcoin-prices`);
});

module.exports = app;