// Global variables
let currentChart = null;
let currentData = null;
let currentSlug = null;
let isUsdView = true;

// Import Bitcoin price data
const BITCOIN_PRICES = window.BITCOIN_PRICES || {};

// DOM elements
const collectionInput = document.getElementById('collectionSlug');
const loadButton = document.getElementById('loadButton');
const statusMessage = document.getElementById('statusMessage');
const statsSection = document.getElementById('statsSection');
const chartSection = document.getElementById('chartSection');
const chartTitle = document.getElementById('chartTitle');
const downloadCsv = document.getElementById('downloadCsv');
const toggleView = document.getElementById('toggleView');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    checkUrlParams();
});

function setupEventListeners() {
    // Load button
    loadButton.addEventListener('click', handleLoadCollection);

    // Enter key on input
    collectionInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLoadCollection();
        }
    });

    // Popular collection tags
    document.querySelectorAll('.collection-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const slug = this.getAttribute('data-slug');
            collectionInput.value = slug;
            handleLoadCollection();
        });
    });

    // Download CSV
    downloadCsv.addEventListener('click', handleDownloadCsv);

    // Toggle view
    toggleView.addEventListener('click', handleToggleView);
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (slug) {
        collectionInput.value = slug;
        handleLoadCollection();
    }
}

async function handleLoadCollection() {
    const slug = collectionInput.value.trim();
    if (!slug) {
        showStatus('Please enter a collection slug', 'error');
        return;
    }

    currentSlug = slug;
    setLoadingState(true);
    hideStats();
    hideChart();

    try {
        const useCoinGecko = document.getElementById('useCoinGecko').checked;
        const statusText = useCoinGecko ? 'Fetching collection data with CoinGecko...' : 'Fetching collection data...';
        showStatus(statusText, 'loading');

        // Fetch ordinal data from BestInSlot API via CORS proxy
        const bestInSlotUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://v2api.bestinslot.xyz/collection/chart?slug=${slug}`)}`;
        const response = await fetch(bestInSlotUrl);
        const proxyData = await response.json();
        const rawData = JSON.parse(proxyData.contents);

        // Parse and process data
        const ordinalData = parseBestInSlotData(rawData);
        const usdData = await convertToUSD(ordinalData, useCoinGecko);

        const validData = usdData.filter(p => p.usd != null);
        const missingPoints = usdData.length - validData.length;

        if (validData.length === 0) {
            throw new Error('No USD data available for this collection');
        }

        // Calculate statistics
        const usdValues = validData.map(p => p.usd);
        const stats = {
            totalPoints: validData.length,
            missingPoints: missingPoints,
            minUsd: usdValues.length ? Math.min(...usdValues) : 0,
            maxUsd: usdValues.length ? Math.max(...usdValues) : 0,
            avgUsd: usdValues.length ? usdValues.reduce((a, b) => a + b, 0) / usdValues.length : 0,
            dateRange: {
                start: ordinalData.length ? ordinalData[0].day : null,
                end: ordinalData.length ? ordinalData[ordinalData.length - 1].day : null
            }
        };

        currentData = usdData;

        // Update UI
        updateStats(stats);
        createChart(validData);
        updateUrl(slug);

        showStatus(`Successfully loaded ${validData.length} data points for "${slug}"`, 'success');

        // Auto-hide success message
        setTimeout(() => hideStatus(), 3000);

    } catch (error) {
        console.error('Error loading collection:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(loading) {
    loadButton.disabled = loading;
    const buttonText = loadButton.querySelector('.button-text');
    const spinner = loadButton.querySelector('.spinner');

    if (loading) {
        buttonText.textContent = 'Loading...';
        spinner.classList.remove('hidden');
    } else {
        buttonText.textContent = 'Load Collection';
        spinner.classList.add('hidden');
    }
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
}

function hideStatus() {
    statusMessage.classList.add('hidden');
}

function updateStats(stats) {
    document.getElementById('statTotal').textContent = stats.totalPoints.toLocaleString();
    document.getElementById('statMin').textContent = '$' + stats.minUsd.toFixed(2);
    document.getElementById('statMax').textContent = '$' + stats.maxUsd.toFixed(2);
    document.getElementById('statAvg').textContent = '$' + stats.avgUsd.toFixed(2);

    const startDate = new Date(stats.dateRange.start);
    const endDate = new Date(stats.dateRange.end);
    // const formatDate = (date) => {
    //     const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    //                    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    //     return `${months[date.getMonth()]}'${date.getFullYear().toString().slice(-2)}`;
    // };
    // document.getElementById('statRange').textContent = `${formatDate(startDate)}-${formatDate(endDate)}`;

    // document.getElementById('statMissing').textContent = stats.missingPoints.toLocaleString();

    statsSection.classList.remove('hidden');
}

function hideStats() {
    statsSection.classList.add('hidden');
}

function createChart(data) {
    const ctx = document.getElementById('priceChart').getContext('2d');

    // Destroy existing chart
    if (currentChart) {
        currentChart.destroy();
    }

    // Prepare data
    const labels = data.map(p => p.day);
    const usdPrices = data.map(p => p.usd);
    const btcPrices = data.map(p => p.btc);

    const chartData = isUsdView ? usdPrices : btcPrices;
    const chartLabel = isUsdView ? 'USD Price' : 'BTC Price';
    const color = isUsdView ? '#667eea' : '#f39c12';

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: chartLabel,
                data: chartData,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 8,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: color,
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: color,
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        title: function(context) {
                            return new Date(context[0].label).toLocaleDateString();
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const point = data[index];

                            if (isUsdView) {
                                return [
                                    `USD Price: $${point.usd.toFixed(2)}`,
                                    `BTC Price: ${point.btc.toFixed(6)} BTC`,
                                    `BTC Rate: $${point.btcPrice.toLocaleString()}/BTC`
                                ];
                            } else {
                                return [
                                    `BTC Price: ${point.btc.toFixed(6)} BTC`,
                                    `USD Value: $${point.usd.toFixed(2)}`,
                                    `BTC Rate: $${point.btcPrice.toLocaleString()}/BTC`
                                ];
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        color: '#666'
                    }
                },
                y: {
                    display: true,
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            if (isUsdView) {
                                return '$' + value.toFixed(2);
                            } else {
                                return value.toFixed(6) + ' BTC';
                            }
                        },
                        color: '#666'
                    }
                }
            }
        }
    });

    // Update chart title and show section
    chartTitle.textContent = `${currentSlug.toUpperCase()} - ${isUsdView ? 'USD' : 'BTC'} Price History`;
    chartSection.classList.remove('hidden');
}

function hideChart() {
    chartSection.classList.add('hidden');
}

function handleToggleView() {
    if (!currentData) return;

    isUsdView = !isUsdView;
    toggleView.textContent = isUsdView ? 'BTC View' : 'USD View';

    const validData = currentData.filter(p => p.usd != null);
    createChart(validData);
}

async function handleDownloadCsv() {
    if (!currentSlug || !currentData) return;

    try {
        showStatus('Generating CSV...', 'loading');

        // Generate CSV data
        const csvRows = [['day', 'btc', 'usd', 'btc_usd_px']];
        currentData.forEach(p => {
            csvRows.push([p.day, p.btc, p.usd || '', p.btcPrice || '']);
        });

        // Convert to CSV string using Papa Parse
        const csv = Papa.unparse(csvRows);

        // Create and download the file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentSlug}_usd_timeseries.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showStatus('CSV downloaded successfully!', 'success');
        setTimeout(() => hideStatus(), 2000);

    } catch (error) {
        console.error('Download error:', error);
        showStatus(`Download failed: ${error.message}`, 'error');
    }
}

function updateUrl(slug) {
    const url = new URL(window.location);
    url.searchParams.set('slug', slug);
    window.history.replaceState({}, '', url);
}

// Utility functions from server.js
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
        const response = await fetch(url);
        const data = await response.json();

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

function formatNumber(num) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}