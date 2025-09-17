#!/usr/bin/env node

/**
 * BestInSlot USD CLI Tool
 * Fetches ordinal price data and converts to USD using BTC/USD rates
 */

const fs = require('fs');
const https = require('https');

// Configuration
const BESTINSLOT_API = 'https://v2api.bestinslot.xyz/collection/chart?slug=';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=';

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function error(message) {
  console.error(`[ERROR] ${message}`);
}

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

function looksLikeDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);
}

function numify(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// HTTP request helper
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

// Load BTC/USD data from CSV file
function loadBtcUsdData(filepath) {
  log(`Loading BTC/USD data from ${filepath}`);
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.trim().split(/\r?\n/);
  const data = {};

  lines.forEach(line => {
    const parts = line.split(',');
    if (parts.length >= 2) {
      const date = parts[0].trim();
      const price = parts[1].trim().replace(/[",]/g, ''); // Remove quotes and commas
      const numPrice = numify(price);

      if (looksLikeDate(date) && numPrice != null) {
        data[date] = numPrice;
      }
    }
  });

  log(`Loaded ${Object.keys(data).length} BTC/USD price points`);
  return data;
}

// Fetch ordinal data from BestInSlot API
async function fetchBestInSlot(slug) {
  log(`Fetching ordinal data for slug: ${slug}`);
  const data = await httpsGet(BESTINSLOT_API + encodeURIComponent(slug));

  let arr = null;
  if (Array.isArray(data)) {
    arr = data;
  } else {
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

  if (!arr || !arr.length) {
    throw new Error('No array series in BestInSlot response');
  }

  const points = [];
  for (const row of arr) {
    let ts = null, y = null;

    if (Array.isArray(row)) {
      ts = row[0];
      y = row[2] != null ? row[2] : row[1];
    } else if (typeof row === 'object' && row) {
      ts = row.timestamp ?? row.time ?? row.t ?? row.date ?? row.day;
      // For BestInSlot API, prioritize 'price' field over others
      y = row.price ?? row.value ?? row.close;
      if (y == null) {
        // Fallback: find first numeric field that's not timestamp/volume/id
        for (const k of Object.keys(row)) {
          if (['id', 'timestamp', 'time', 't', 'date', 'day', 'volume', 'slug'].includes(k)) continue;
          const num = Number(row[k]);
          if (Number.isFinite(num)) {
            y = num;
            break;
          }
        }
      }
    }

    const d = toDate(ts);
    if (d && Number.isFinite(Number(y))) {
      points.push({ day: dayKey(d), btc: Number(y) });
    }
  }

  // Keep last value per day
  const map = new Map();
  points.sort((a, b) => a.day.localeCompare(b.day)).forEach(p => map.set(p.day, p.btc));
  const result = Array.from(map.entries()).map(([day, btc]) => ({ day, btc }));

  log(`Processed ${result.length} daily price points from ${points.length} raw data points`);
  return result;
}

// Fetch BTC/USD data from CoinGecko for gap filling
async function fetchCoinGecko(fromDay, toDay) {
  log(`Fetching BTC/USD data from CoinGecko for ${fromDay} to ${toDay}`);

  const fromUnix = Math.floor(new Date(fromDay + 'T00:00:00Z').getTime() / 1000);
  const toUnix = Math.floor(new Date(toDay + 'T23:59:59Z').getTime() / 1000);

  const url = COINGECKO_API + fromUnix + '&to=' + toUnix;
  const data = await httpsGet(url);

  const map = new Map();
  (data.prices || []).forEach(([ts, price]) => {
    const d = new Date(ts);
    map.set(dayKey(d), price);
  });

  log(`Fetched ${map.size} BTC/USD prices from CoinGecko`);
  return map;
}

// Convert to CSV format
function toCSV(points) {
  const rows = ['day,btc,usd,btc_usd_px'];
  points.forEach(p => {
    rows.push(`${p.day},${p.btc},${p.usd || ''},${p.px || ''}`);
  });
  return rows.join('\\n');
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node cli.js <collection-slug> <btc-usd-csv-file> [--use-coingecko]');
    console.log('Example: node cli.js wizards "Bitcoin Historical Data JUL 14 2025.csv" --use-coingecko');
    process.exit(1);
  }

  const slug = args[0];
  const btcUsdFile = args[1];
  const useCoinGecko = args.includes('--use-coingecko');

  try {
    // Load BTC/USD historical data
    const btcUsdData = loadBtcUsdData(btcUsdFile);

    // Fetch ordinal price data
    const ordinalData = await fetchBestInSlot(slug);

    if (!ordinalData.length) {
      error('No ordinal data found');
      process.exit(1);
    }

    const minDay = ordinalData[0].day;
    const maxDay = ordinalData[ordinalData.length - 1].day;

    log(`Ordinal data range: ${minDay} to ${maxDay}`);

    // Fetch CoinGecko data if needed for gap filling
    let coinGeckoData = new Map();
    if (useCoinGecko) {
      try {
        coinGeckoData = await fetchCoinGecko(minDay, maxDay);
      } catch (e) {
        error(`CoinGecko fetch failed: ${e.message}`);
      }
    }

    // Map ordinal prices to USD
    const points = ordinalData.map(ord => {
      // Try exact day match, then monthly fallback, then CoinGecko
      const px = btcUsdData[ord.day] ??
                 btcUsdData[ord.day.slice(0, 7)] ??
                 coinGeckoData.get(ord.day) ??
                 null;

      const usd = (px != null) ? ord.btc * px : null;
      return {
        day: ord.day,
        btc: ord.btc,
        px: px,
        usd: usd
      };
    });

    const validPoints = points.filter(p => p.usd != null);
    const missing = points.length - validPoints.length;

    log(`Mapped ${validPoints.length} points to USD${missing ? `, ${missing} missing` : ''}`);

    if (!validPoints.length) {
      error('No USD points could be calculated');
      process.exit(1);
    }

    // Statistics
    const usdValues = validPoints.map(p => p.usd);
    const minUsd = Math.min(...usdValues);
    const maxUsd = Math.max(...usdValues);
    const avgUsd = usdValues.reduce((a, b) => a + b, 0) / usdValues.length;

    log(`USD Statistics: Min=$${minUsd.toFixed(2)}, Max=$${maxUsd.toFixed(2)}, Avg=$${avgUsd.toFixed(2)}`);

    // Generate CSV output
    const csvContent = toCSV(points);
    const outputFile = `${slug}_usd_timeseries.csv`;
    fs.writeFileSync(outputFile, csvContent);

    log(`CSV written to ${outputFile}`);
    console.log('\\nSample data:');
    console.log(validPoints.slice(0, 5).map(p =>
      `${p.day}: ${p.btc} BTC → $${p.usd.toFixed(2)} (@ $${p.px.toFixed(2)}/BTC)`
    ).join('\\n'));

  } catch (e) {
    error(e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchBestInSlot, fetchCoinGecko, loadBtcUsdData };