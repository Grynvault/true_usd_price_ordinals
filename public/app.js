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
            if (slug) {
                collectionInput.value = slug;
                handleLoadCollection();
            }
        });
    });

    // Download CSV
    downloadCsv.addEventListener('click', handleDownloadCsv);

    // Toggle view
    toggleView.addEventListener('click', handleToggleView);

    // Hiscores functionality
    const showHiscoresBtn = document.getElementById('showHiscores');
    const hideHiscoresBtn = document.getElementById('hideHiscores');

    if (showHiscoresBtn) {
        showHiscoresBtn.addEventListener('click', showHiscores);
    }
    if (hideHiscoresBtn) {
        hideHiscoresBtn.addEventListener('click', hideHiscores);
    }
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
        const useCoinGeckoElement = document.getElementById('useCoinGecko');
        const useCoinGecko = useCoinGeckoElement ? useCoinGeckoElement.checked : false;
        const statusText = 'Fetching collection data...';
        showStatus(statusText, 'loading');

        // Fetch ordinal data via Supabase Edge Function
        const FUNCTION_URL = window.SUPABASE_FUNCTION_URL || 'https://lfwsooldipswbvbpnoxo.functions.supabase.co';
        const response = await fetch(`${FUNCTION_URL}/price-api?slug=${encodeURIComponent(slug)}${useCoinGecko ? '&useCoinGecko=true' : ''}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch collection data');
        }

        currentData = result.data;
        const stats = result.stats;

        // Filter valid data points for display
        const validData = currentData.filter(p => p.usd != null);

        if (validData.length === 0) {
            throw new Error('No USD data available for this collection');
        }

        // Update UI
        updateStats(stats);
        // TODO: Disabled due to API key requirement
        // await loadCollectionPreview(slug);
        // await updateSearchPreview(slug);
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
    const color = isUsdView ? '#e67e22' : '#d35400';

    // Calculate simple trend line connecting first and last half averages
    const trendData = calculateSimpleTrend(data, isUsdView);

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
            }, {
                label: 'Trend Line',
                data: trendData,
                borderColor: '#3498db',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [8, 4],
                fill: false,
                tension: 0,
                pointRadius: 0,
                pointHoverRadius: 0,
                pointBackgroundColor: '#3498db',
                pointBorderColor: '#3498db',
                pointBorderWidth: 1
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
                    filter: (ctx) => ctx.datasetIndex === 0,
                    callbacks: {
                        title: function(context) {
                            return new Date(context[0].label).toLocaleDateString();
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const point = data[index];

                            if (isUsdView) {
                                return `USD Price: $${point.usd.toFixed(2)}`;
                            } else {
                                return `BTC Price: ${point.btc.toFixed(6)} BTC`;
                            }
                        },
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            const point = data[index];

                            if (isUsdView) {
                                return [
                                    `BTC Price: ${point.btc.toFixed(6)} BTC`,
                                    `BTC Rate: $${point.btcPrice.toLocaleString()}/BTC`
                                ];
                            } else {
                                return [
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
    if (!currentSlug) return;

    try {
        showStatus('Generating CSV...', 'loading');

        // Use Supabase CSV export function
        const FUNCTION_URL = window.SUPABASE_FUNCTION_URL || 'https://lfwsooldipswbvbpnoxo.functions.supabase.co';
        const response = await fetch(`${FUNCTION_URL}/price-api?slug=${encodeURIComponent(currentSlug)}&format=csv`);

        if (!response.ok) {
            throw new Error('Failed to generate CSV');
        }

        const blob = await response.blob();
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

// Hiscores functionality
async function showHiscores() {
    try {
        // Hide other sections
        document.getElementById('statsSection').classList.add('hidden');
        document.getElementById('chartSection').classList.add('hidden');

        // Show hiscores section
        const hiscoresSection = document.getElementById('hiscoresSection');
        hiscoresSection.classList.remove('hidden');

        showStatus('Loading top performing collections...', 'loading');

        // Fetch hiscores data
        const FUNCTION_URL = window.SUPABASE_FUNCTION_URL || 'https://lfwsooldipswbvbpnoxo.functions.supabase.co';
        const response = await fetch(`${FUNCTION_URL}/price-api/hiscores?limit=12`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch hiscores');
        }

        displayHiscores(result.hiscores);

        if (result.hiscores.length === 0) {
            showStatus('No collections in hiscores yet. Collections need to be analyzed first by searching for them.', 'loading');
        } else {
            hideStatus();
        }

    } catch (error) {
        console.error('Error loading hiscores:', error);
        showStatus(`Error loading hiscores: ${error.message}`, 'error');
    }
}

function displayHiscores(hiscores) {
    const hiscoresList = document.getElementById('hiscoresList');

    if (hiscores.length === 0) {
        hiscoresList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">
                <h4>No collections analyzed yet</h4>
                <p>Collections appear in hiscores after being searched and analyzed.<br>
                Try searching for some collections first!</p>
            </div>
        `;
        return;
    }

    hiscoresList.innerHTML = hiscores.map((collection, index) => `
        <div class="hiscore-card" onclick="loadCollectionFromHiscore('${collection.slug}')">
            <div class="hiscore-header">
                ${collection.logo_image_base64 ?
                    `<img src="${collection.logo_image_base64}" class="hiscore-logo" alt="${collection.name}">` :
                    `<img src="logos/images.png" class="hiscore-logo" alt="${collection.name}">`
                }
                <div>
                    <div class="hiscore-name">${collection.name}</div>
                    <div style="font-size: 0.8rem; color: #999;">${collection.slug}</div>
                </div>
            </div>
            <div class="hiscore-stats">
                <div class="hiscore-stat">
                    <div class="hiscore-stat-value">${collection.gradient > 0 ? '+' : ''}${collection.gradient.toFixed(2)}</div>
                    <div class="hiscore-stat-label">Gradient</div>
                </div>
                <div class="hiscore-stat">
                    <div class="hiscore-stat-value">$${collection.avg_usd.toFixed(0)}</div>
                    <div class="hiscore-stat-label">Avg Price</div>
                </div>
            </div>
            <div class="hiscore-performance">
                <div class="hiscore-performance-score">${collection.total_points} pts</div>
                <div class="hiscore-performance-label">Data Points</div>
            </div>
        </div>
    `).join('');
}

function hideHiscores() {
    document.getElementById('hiscoresSection').classList.add('hidden');
    hideStatus();
}

function loadCollectionFromHiscore(slug) {
    hideHiscores();
    collectionInput.value = slug;
    handleLoadCollection();
}

// Calculate split trend line that cuts between start-end line and first-second half averages line
function calculateSimpleTrend(data, isUsdView) {
    if (data.length < 4) return data.map(() => null); // Need at least 4 data points

    const values = data.map(p => isUsdView ? p.usd : p.btc);
    const validValues = values.filter(v => v !== null && v !== undefined);

    if (validValues.length < 4) return data.map(() => null);

    // Find first and last valid prices
    let firstPrice = null;
    let lastPrice = null;

    for (let i = 0; i < values.length; i++) {
        if (values[i] !== null && values[i] !== undefined) {
            if (firstPrice === null) firstPrice = values[i];
            lastPrice = values[i];
        }
    }

    // Split data into first half and last half for averages
    const midPoint = Math.floor(validValues.length / 2);
    const firstHalf = validValues.slice(0, midPoint);
    const lastHalf = validValues.slice(midPoint);

    // Calculate averages for each half
    const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const lastHalfAvg = lastHalf.reduce((sum, val) => sum + val, 0) / lastHalf.length;

    // Create the split trend line
    const trendData = [];

    for (let i = 0; i < data.length; i++) {
        const t = i / (data.length - 1); // Normalize position to 0-1

        // Line 1: Start price to end price (straight line)
        const startEndLine = firstPrice + (lastPrice - firstPrice) * t;

        // Line 2: First half average to last half average (straight line)
        const avgLine = firstHalfAvg + (lastHalfAvg - firstHalfAvg) * t;

        // Final trend line: Split/average between the two lines
        const splitTrendValue = (startEndLine + avgLine) / 2;

        trendData.push(splitTrendValue);
    }

    return trendData;
}

// Load collection preview image and info
async function loadCollectionPreview(slug) {
    try {
        // Step 1: Get collection metadata from BestInSlot v3 API
        const infoResponse = await fetch(`https://api.bestinslot.xyz/v3/collection/info?slug=${encodeURIComponent(slug)}`);

        if (!infoResponse.ok) {
            throw new Error('Collection not found');
        }

        const collectionInfo = await infoResponse.json();

        // Show the preview section
        const previewSection = document.getElementById('collectionPreview');
        const previewImage = document.getElementById('previewImage');
        const previewTitle = document.getElementById('previewTitle');
        const previewDescription = document.getElementById('previewDescription');

        // Set collection info
        previewTitle.textContent = collectionInfo.name || slug.toUpperCase();
        previewDescription.textContent = collectionInfo.description || `Collection: ${slug}`;

        // Step 2: Try to get image from collection metadata first
        let imageUrl = collectionInfo.logo ||
                      collectionInfo.banner ||
                      collectionInfo.image ||
                      collectionInfo.icon ||
                      collectionInfo.thumbnail ||
                      null;

        // Step 3: If no image in metadata, get a sample inscription from the collection
        if (!imageUrl) {
            try {
                const inscriptionsResponse = await fetch(`https://api.bestinslot.xyz/v3/collection/inscriptions?slug=${encodeURIComponent(slug)}`);

                if (inscriptionsResponse.ok) {
                    const inscriptionsData = await inscriptionsResponse.json();

                    if (inscriptionsData.inscriptions && inscriptionsData.inscriptions.length > 0) {
                        // Get the first inscription ID (or you could implement other logic like most recent, floor, etc.)
                        const firstInscriptionId = inscriptionsData.inscriptions[0].id || inscriptionsData.inscriptions[0];

                        // Step 4: Use ordinals.com preview for the inscription
                        imageUrl = `https://ordinals.com/preview/${firstInscriptionId}`;
                    }
                }
            } catch (inscriptionError) {
                console.log('Could not fetch sample inscription:', inscriptionError.message);
            }
        }

        // Set the image
        if (imageUrl) {
            previewImage.src = imageUrl;
            previewImage.onerror = function() {
                // Fallback: try og:image scraping as last resort
                this.src = `https://bestinslot.xyz/ordinals/collections/${slug}/og-image`;
                this.onerror = function() {
                    this.style.display = 'none';
                };
            };
            previewImage.style.display = 'block';
        } else {
            previewImage.style.display = 'none';
        }

        previewSection.classList.remove('hidden');

    } catch (error) {
        console.log('Could not load collection preview:', error.message);
        // Hide preview section if we can't load collection info
        document.getElementById('collectionPreview').classList.add('hidden');
    }
}

// Update search preview image (smaller version in search bar)
async function updateSearchPreview(slug) {
    try {
        // Step 1: Get collection metadata from BestInSlot v3 API
        const infoResponse = await fetch(`https://api.bestinslot.xyz/v3/collection/info?slug=${encodeURIComponent(slug)}`);

        if (!infoResponse.ok) {
            throw new Error('Collection not found');
        }

        const collectionInfo = await infoResponse.json();

        // Show the search preview section
        const searchPreviewSection = document.getElementById('searchCollectionPreview');
        const searchPreviewImage = document.getElementById('searchPreviewImage');

        // Step 2: Try to get image from collection metadata first
        let imageUrl = collectionInfo.logo ||
                      collectionInfo.banner ||
                      collectionInfo.image ||
                      collectionInfo.icon ||
                      collectionInfo.thumbnail ||
                      null;

        // Step 3: If no image in metadata, get a sample inscription from the collection
        if (!imageUrl) {
            try {
                const inscriptionsResponse = await fetch(`https://api.bestinslot.xyz/v3/collection/inscriptions?slug=${encodeURIComponent(slug)}`);

                if (inscriptionsResponse.ok) {
                    const inscriptionsData = await inscriptionsResponse.json();

                    if (inscriptionsData.inscriptions && inscriptionsData.inscriptions.length > 0) {
                        // Get the first inscription ID
                        const firstInscriptionId = inscriptionsData.inscriptions[0].id || inscriptionsData.inscriptions[0];

                        // Step 4: Use ordinals.com preview for the inscription
                        imageUrl = `https://ordinals.com/preview/${firstInscriptionId}`;
                    }
                }
            } catch (inscriptionError) {
                console.log('Could not fetch sample inscription for search preview:', inscriptionError.message);
            }
        }

        // Set the image
        if (imageUrl) {
            searchPreviewImage.src = imageUrl;
            searchPreviewImage.onerror = function() {
                // Fallback: try og:image scraping as last resort
                this.src = `https://bestinslot.xyz/ordinals/collections/${slug}/og-image`;
                this.onerror = function() {
                    this.parentElement.classList.add('hidden');
                };
            };
            searchPreviewSection.classList.remove('hidden');
        } else {
            searchPreviewSection.classList.add('hidden');
        }

    } catch (error) {
        console.log('Could not load search collection preview:', error.message);
        // Hide search preview section if we can't load collection info
        document.getElementById('searchCollectionPreview').classList.add('hidden');
    }
}

// Hiscores functionality
let hiscoresData = [];
let currentHiscoresPage = 1;
let hiscoresPerPage = 10;

async function showHiscores() {
    console.log('Loading hiscores...');

    // Hide main sections and show hiscores section
    hideStats();
    hideChart();
    document.getElementById('hiscoresSection').classList.remove('hidden');

    const hiscoresList = document.getElementById('hiscoresList');
    hiscoresList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading top performers...</div>';

    try {
        // Fetch collections data for hiscores
        const FUNCTION_URL = window.SUPABASE_FUNCTION_URL || 'https://lfwsooldipswbvbpnoxo.functions.supabase.co';
        const response = await fetch(`${FUNCTION_URL}/price-api/collections`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('Collections data:', data);

        if (!data.success || !data.collections) {
            throw new Error('Invalid response format');
        }

        // Filter collections with analytics and gradients, sort by gradient descending
        // Only show collections with 90+ data points for statistical significance
        hiscoresData = data.collections
            .filter(c => c.collection_analytics && c.collection_analytics.trend_gradient != null && c.collection_analytics.total_points >= 90)
            .sort((a, b) => b.collection_analytics.trend_gradient - a.collection_analytics.trend_gradient);

        if (hiscoresData.length === 0) {
            hiscoresList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No collections with sufficient data found. Try loading some collections first.</div>';
            return;
        }

        // Reset pagination
        currentHiscoresPage = 1;
        hiscoresPerPage = 10;

        // Render hiscores with pagination
        renderHiscores();

    } catch (error) {
        console.error('Error loading hiscores:', error);
        hiscoresList.innerHTML = `<div style="text-align: center; padding: 20px; color: #ff4757;">Error loading hiscores: ${error.message}</div>`;
    }
}

function renderHiscores() {
    const hiscoresList = document.getElementById('hiscoresList');
    const startIndex = (currentHiscoresPage - 1) * hiscoresPerPage;
    const endIndex = startIndex + hiscoresPerPage;
    const currentPageData = hiscoresData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(hiscoresData.length / hiscoresPerPage);

    // Update button states in header
    const top10Button = document.getElementById('top10Button');
    const top100Button = document.getElementById('top100Button');
    if (top10Button && top100Button) {
        top10Button.classList.toggle('active', hiscoresPerPage === 10);
        top100Button.classList.toggle('active', hiscoresPerPage === 100);
    }

    // Render pagination controls only if needed
    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = `
            <div class="hiscores-pagination-nav">
                <button onclick="changeHiscoresPage(${currentHiscoresPage - 1})" ${currentHiscoresPage === 1 ? 'disabled' : ''}>← Prev</button>
                <span>Page ${currentHiscoresPage} of ${totalPages}</span>
                <button onclick="changeHiscoresPage(${currentHiscoresPage + 1})" ${currentHiscoresPage === totalPages ? 'disabled' : ''}>Next →</button>
            </div>
        `;
    }

    // Render column headers
    const headersHtml = `
        <div class="hiscores-list-header">
            <div class="hiscore-header-rank">Rank</div>
            <div class="hiscore-header-image"></div>
            <div class="hiscore-header-name">Collection</div>
            <div class="hiscore-header-avg-usd">Avg Price</div>
            <div class="hiscore-header-data-points">Data Points</div>
            <div class="hiscore-header-gradient">Trend Gradient</div>
        </div>
    `;

    // Render hiscore list items with images
    const listHtml = currentPageData.map((collection, index) => {
        const analytics = collection.collection_analytics;
        const gradientText = analytics.trend_gradient > 0 ? '+' + analytics.trend_gradient.toFixed(4) : analytics.trend_gradient.toFixed(4);
        const trendClass = analytics.trend_gradient > 0 ? 'positive' : 'negative';
        const rankNumber = startIndex + index + 1;

        // Create image element - use cached base64 image if available, otherwise use default logo
        const imageHtml = collection.logo_image_base64 ?
            `<img src="${collection.logo_image_base64}" class="hiscore-image" alt="${collection.name || collection.slug}">` :
            `<img src="logos/images.png" class="hiscore-image" alt="${collection.name || collection.slug}">`;

        return `
            <div class="hiscore-list-item" onclick="loadCollectionFromHiscores('${collection.slug}')">
                <div class="hiscore-rank">#${rankNumber}</div>
                ${imageHtml}
                <div class="hiscore-name">${collection.name || collection.slug.toUpperCase()}</div>
                <div class="hiscore-avg-usd">$${analytics.avg_usd?.toFixed(2) || 'N/A'}</div>
                <div class="hiscore-data-points">${analytics.total_points || 0} pts</div>
                <div class="hiscore-gradient ${trendClass}">${gradientText}</div>
            </div>
        `;
    }).join('');

    hiscoresList.innerHTML = paginationHtml + '<div class="hiscores-list">' + headersHtml + listHtml + '</div>';
}

function changeHiscoresPerPage(newPerPage) {
    hiscoresPerPage = newPerPage;
    currentHiscoresPage = 1; // Reset to first page
    renderHiscores();
}

function changeHiscoresPage(newPage) {
    const totalPages = Math.ceil(hiscoresData.length / hiscoresPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
        currentHiscoresPage = newPage;
        renderHiscores();
    }
}

function hideHiscores() {
    document.getElementById('hiscoresSection').classList.add('hidden');
}

function loadCollectionFromHiscores(slug) {
    // Hide hiscores and load the collection
    hideHiscores();
    collectionInput.value = slug;
    handleLoadCollection();
}