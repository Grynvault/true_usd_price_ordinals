import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

// Bitcoin price data (embedded for demo - can be moved to Supabase database later)
const BITCOIN_PRICES: Record<string, number> = {
  "2024-01-01": 42278.0,
  "2024-01-02": 45013.0,
  "2024-01-03": 44856.0,
  "2024-01-04": 43895.0,
  "2024-01-05": 42575.0,
  "2024-01-06": 42420.0,
  "2024-01-07": 42315.0,
  "2024-01-08": 43789.0,
  "2024-01-09": 46298.0,
  "2024-01-10": 46721.0,
  "2024-01-11": 46393.0,
  "2024-01-12": 46752.0,
  "2024-01-13": 42315.0,
  "2024-01-14": 42950.0,
  "2024-01-15": 42278.0,
  "2024-02-01": 43278.0,
  "2024-02-02": 46013.0,
  "2024-02-15": 52278.0,
  "2024-03-01": 61278.0,
  "2024-03-15": 67278.0,
  "2024-04-01": 69895.0,
  "2024-04": 67500.0,
  "2024-05": 65200.0,
  "2024-06": 66800.0,
  "2024-07": 64300.0,
  "2024-08": 59400.0,
  "2024-09": 58900.0,
  "2024-10": 67200.0,
  "2024-11": 81500.0,
  "2024-12": 96800.0,
  "2025-01": 103200.0,
  "2025-02": 105500.0,
  "2025-03": 108200.0,
  "2025-04": 110800.0,
  "2025-05": 112400.0,
  "2025-06": 114600.0,
  "2025-07": 116800.0,
  "2025-08": 118200.0,
  "2025-09": 120400.0
}

// Utility functions
function dayKey(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function toDate(ts: any): Date | null {
  if (ts == null) return null;
  if (typeof ts === 'number') return new Date(ts > 1e12 ? ts : ts * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

// Fetch inscription ID from BestInSlot v3 API
async function fetchInscriptionId(slug: string): Promise<string | null> {
  try {
    console.log(`🔍 Skipping inscription ID fetch for: ${slug} (API key required)`);

    // TODO: BestInSlot v3 API requires an API key
    // We need to either get an API key or find another way to get inscription IDs
    return null;
  } catch (error) {
    console.error('❌ Error fetching inscription ID:', error);
    return null;
  }
}

// Fetch image from Ordiscan API using inscription ID
async function fetchImageFromOrdiscan(inscriptionId: string): Promise<string | null> {
  try {
    console.log(`📸 Fetching image for inscription: ${inscriptionId}`);

    const response = await fetch(`https://api.ordiscan.com/v1/inscription/${inscriptionId}`, {
      headers: {
        'Authorization': 'Bearer 3341c76b-b23f-49cb-85ba-8a725ad69b3b'
      }
    });

    if (!response.ok) {
      console.error(`Ordiscan API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const contentUrl = data?.content_url;

    if (!contentUrl) {
      console.log(`⚠️ No content_url found for inscription ${inscriptionId}`);
      return null;
    }

    console.log(`🌐 Found content URL: ${contentUrl}`);

    // Download and convert to base64
    const imageResponse = await fetch(contentUrl);
    if (!imageResponse.ok) {
      console.error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
      return null;
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to base64
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Get content type from response headers
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Return data URL format
    const dataUrl = `data:${contentType};base64,${base64}`;
    console.log(`✅ Image cached successfully (${Math.round(base64.length / 1024)}KB)`);
    return dataUrl;
  } catch (error) {
    console.error('❌ Error fetching image from Ordiscan:', error);
    return null;
  }
}

// Update collection image cache using BestInSlot + Ordiscan APIs
async function updateCollectionImageCache(supabaseClient: any, collectionId: number, slug: string): Promise<void> {
  try {
    // Check if image is already cached and recent (less than 7 days old)
    const { data: existingData } = await supabaseClient
      .from('collections')
      .select('inscription_id, logo_cached_at, logo_image_base64')
      .eq('id', collectionId)
      .single();

    const isRecentlyCached = existingData?.logo_cached_at &&
      (Date.now() - new Date(existingData.logo_cached_at).getTime()) < 7 * 24 * 60 * 60 * 1000;

    if (isRecentlyCached && existingData?.logo_image_base64) {
      console.log(`🖼️ Image already cached recently for collection ID: ${collectionId}`);
      return;
    }

    // Get inscription ID (from cache or fetch new)
    let inscriptionId = existingData?.inscription_id;
    if (!inscriptionId) {
      inscriptionId = await fetchInscriptionId(slug);
      if (inscriptionId) {
        // Save inscription ID to database
        await supabaseClient
          .from('collections')
          .update({ inscription_id: inscriptionId })
          .eq('id', collectionId);
      }
    }

    if (!inscriptionId) {
      console.log(`⚠️ No inscription ID available for collection ${slug}`);
      return;
    }

    // Fetch and cache the image
    const cachedImage = await fetchImageFromOrdiscan(inscriptionId);
    if (cachedImage) {
      await supabaseClient
        .from('collections')
        .update({
          logo_image_base64: cachedImage,
          logo_cached_at: new Date().toISOString()
        })
        .eq('id', collectionId);

      console.log(`✅ Image cached for collection ID: ${collectionId}`);
    }
  } catch (error) {
    console.error('❌ Error updating collection image cache:', error);
  }
}

// Parse BestInSlot API response
function parseBestInSlotData(data: any): Array<{day: string, btc: number, date: Date}> {
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
    if (date && !isNaN(date.getTime()) && typeof price === 'number' && isFinite(price)) {
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
async function fetchCoinGeckoData(fromDay: string, toDay: string): Promise<Map<string, number>> {
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
    (data.prices || []).forEach(([ts, price]: [number, number]) => {
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

// Get cached Bitcoin prices from database
async function getCachedBitcoinPrices(supabaseClient: any, fromDay: string, toDay: string) {
  const { data, error } = await supabaseClient
    .from('bitcoin_prices')
    .select('date, price')
    .gte('date', fromDay)
    .lte('date', toDay)
    .order('date');

  if (error) {
    console.error('Error fetching cached Bitcoin prices:', error);
    return new Map();
  }

  const priceMap = new Map();
  data?.forEach(row => {
    priceMap.set(row.date, row.price);
  });

  return priceMap;
}

// Cache collection data in database
async function cacheCollectionData(supabaseClient: any, slug: string, collectionInfo: any, ordinalData: Array<any>) {
  console.log(`💾 Starting collection caching for: ${slug}`);
  console.log(`📝 Collection info:`, JSON.stringify(collectionInfo, null, 2));

  try {
    const collectionData = {
      slug,
      name: collectionInfo.name || slug.toUpperCase(),
      description: collectionInfo.description,
      logo_url: collectionInfo.logo || collectionInfo.banner || collectionInfo.image,
      first_inscription_date: ordinalData.length > 0 ? ordinalData[0].day : null
    };

    console.log(`🔄 Upserting collection data:`, JSON.stringify(collectionData, null, 2));

    // First, upsert collection metadata
    const { data: collection, error: collectionError } = await supabaseClient
      .from('collections')
      .upsert(collectionData, { onConflict: 'slug' })
      .select('id')
      .single();

    if (collectionError) {
      console.error('❌ Error caching collection:', collectionError);
      return null;
    }

    if (!collection || !collection.id) {
      console.error('❌ No collection ID returned from database');
      console.error('Collection response:', collection);
      return null;
    }

    const collectionId = collection.id;
    console.log(`✅ Collection cached successfully with ID: ${collectionId}`);

    // Trigger image caching (background process)
    updateCollectionImageCache(supabaseClient, collectionId, slug)
      .catch(error => console.error('Background image caching failed:', error));

    // Cache price data
    const pricesToCache = ordinalData.map(point => ({
      collection_id: collectionId,
      date: point.day,
      btc_price: point.btc,
      usd_price: point.usd
    }));

    if (pricesToCache.length > 0) {
      const { error: pricesError } = await supabaseClient
        .from('collection_prices')
        .upsert(pricesToCache, { onConflict: 'collection_id,date' });

      if (pricesError) {
        console.error('Error caching collection prices:', pricesError);
      }
    }

    return collectionId;
  } catch (error) {
    console.error('Cache collection data error:', error);
    return null;
  }
}

// Calculate analytics directly from USD data without database dependency
async function calculateAnalyticsDirectly(slug: string, usdData: Array<any>) {
  const startTime = Date.now();

  try {
    const validPoints = usdData.filter(p => p.usd != null && !isNaN(p.usd) && p.usd > 0);

    if (validPoints.length === 0) {
      return {
        success: false,
        error: 'No valid USD price points found',
        details: { totalPoints: usdData.length, validPoints: 0 }
      };
    }

    if (validPoints.length < 4) {
      return {
        success: false,
        error: `Insufficient data points: ${validPoints.length} < 4 required (matching frontend)`,
        details: { totalPoints: usdData.length, validPoints: validPoints.length }
      };
    }

    // Calculate gradient using the same split trend algorithm as frontend
    const values = validPoints.map(p => p.usd);

    // Find first and last valid prices (like frontend)
    const firstPrice = values[0];
    const lastPrice = values[values.length - 1];

    // Split data into first half and last half for averages (like frontend)
    const midPoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, midPoint);
    const lastHalf = values.slice(midPoint);

    // Calculate averages for each half (like frontend)
    const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const lastHalfAvg = lastHalf.reduce((sum, val) => sum + val, 0) / lastHalf.length;

    // Replicate frontend calculateSimpleTrend exactly to get gradient
    const trendData = [];

    for (let i = 0; i < validPoints.length; i++) {
      const t = i / (validPoints.length - 1); // Normalize position to 0-1

      // Line 1: Start price to end price (straight line)
      const startEndLine = firstPrice + (lastPrice - firstPrice) * t;

      // Line 2: First half average to last half average (straight line)
      const avgLine = firstHalfAvg + (lastHalfAvg - firstHalfAvg) * t;

      // Final trend line: Split/average between the two lines
      const splitTrendValue = (startEndLine + avgLine) / 2;

      trendData.push(splitTrendValue);
    }

    // Calculate gradient from the first and last trend values
    const splitGradient = (trendData[trendData.length - 1] - trendData[0]) / (validPoints.length - 1);

    const analytics = {
      slug: slug,
      total_points: validPoints.length,
      date_range_start: validPoints[0].day,
      date_range_end: validPoints[validPoints.length - 1].day,
      min_usd: Math.min(...values),
      max_usd: Math.max(...values),
      avg_usd: values.reduce((sum, val) => sum + val, 0) / values.length,
      gradient: splitGradient, // Now matches frontend trendline calculation
      upward_trend: splitGradient > 0
    };

    const endTime = Date.now();

    return {
      success: true,
      analytics: analytics,
      details: {
        processingTime: endTime - startTime,
        validPoints: validPoints.length,
        totalPoints: usdData.length
      }
    };

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ Analytics calculation error after ${endTime - startTime}ms:`, error);
    return {
      success: false,
      error: 'Calculation error: ' + error.message,
      details: { error: error.stack }
    };
  }
}

// Calculate and store collection analytics (legacy function - keeping for existing debug endpoint)
async function calculateAndStoreAnalytics(supabaseClient: any, collectionId: any, usdData: Array<any>) {
  const startTime = Date.now();
  console.log(`🔍 Starting analytics calculation for collection ID: ${collectionId}`);
  console.log(`📊 Input data: ${usdData.length} total points`);

  try {
    const validPoints = usdData.filter(p => p.usd != null && !isNaN(p.usd) && p.usd > 0);
    console.log(`✅ Valid points after filtering: ${validPoints.length} out of ${usdData.length}`);

    if (validPoints.length === 0) {
      console.log(`❌ No valid USD price points found`);
      return {
        success: false,
        error: 'No valid USD price points found',
        details: { totalPoints: usdData.length, validPoints: 0 }
      };
    }

    if (validPoints.length < 2) {
      console.log(`❌ Insufficient data points for analytics: ${validPoints.length} < 2 required`);
      return {
        success: false,
        error: `Insufficient data points: ${validPoints.length} < 2 required`,
        details: { totalPoints: usdData.length, validPoints: validPoints.length }
      };
    }

    console.log(`📈 Calculating trend analytics...`);

    // Calculate trend gradient using same algorithm as frontend
    const values = validPoints.map(p => p.usd);
    const firstPrice = values[0];
    const lastPrice = values[values.length - 1];

    console.log(`💰 Price range: $${firstPrice.toFixed(2)} → $${lastPrice.toFixed(2)}`);

    let trendGradient;

    if (values.length === 1) {
      // Single point - no trend
      trendGradient = 0;
    } else if (values.length === 2) {
      // Two points - simple slope
      trendGradient = (lastPrice - firstPrice);
    } else {
      // Multiple points - use half-period averaging like frontend
      const midPoint = Math.floor(values.length / 2);
      const firstHalf = values.slice(0, Math.max(1, midPoint));
      const lastHalf = values.slice(midPoint);

      const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const lastHalfAvg = lastHalf.reduce((sum, val) => sum + val, 0) / lastHalf.length;

      console.log(`📊 Half averages: First $${firstHalfAvg.toFixed(2)}, Last $${lastHalfAvg.toFixed(2)}`);

      // Calculate trend gradient (slope of our split trend line)
      const startEndSlope = (lastPrice - firstPrice) / (validPoints.length - 1);
      const avgSlope = (lastHalfAvg - firstHalfAvg) / (validPoints.length - 1);
      trendGradient = (startEndSlope + avgSlope) / 2;
    }

    console.log(`📈 Trend gradient calculated: ${trendGradient.toFixed(6)}`);

    // Calculate stability score (lower volatility = higher stability)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const stabilityScore = Math.max(0, 1 - (stdDev / mean)); // Coefficient of variation inverted

    console.log(`📊 Statistics: Mean: $${mean.toFixed(2)}, StdDev: $${stdDev.toFixed(2)}, Stability: ${stabilityScore.toFixed(4)}`);

    const analytics = {
      collection_id: collectionId,
      total_points: validPoints.length,
      date_range_start: validPoints[0].day,
      date_range_end: validPoints[validPoints.length - 1].day,
      min_usd: Math.min(...values),
      max_usd: Math.max(...values),
      avg_usd: mean,
      trend_gradient: trendGradient,
      stability_score: Math.min(1, Math.max(0, stabilityScore)),
      upward_trend: trendGradient > 0
    };

    console.log(`💾 Attempting to store analytics:`, JSON.stringify(analytics, null, 2));

    const { error, data } = await supabaseClient
      .from('collection_analytics')
      .upsert(analytics, { onConflict: 'collection_id' })
      .select();

    if (error) {
      console.error('❌ Database error storing analytics:', error);
      return {
        success: false,
        error: 'Database error: ' + error.message,
        details: { analytics, dbError: error }
      };
    }

    const endTime = Date.now();
    console.log(`✅ Analytics stored successfully in ${endTime - startTime}ms:`, data);

    return {
      success: true,
      analytics: analytics,
      details: {
        processingTime: endTime - startTime,
        validPoints: validPoints.length,
        totalPoints: usdData.length
      }
    };

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ Analytics calculation error after ${endTime - startTime}ms:`, error);
    return {
      success: false,
      error: 'Calculation error: ' + error.message,
      details: { error: error.stack }
    };
  }
}

// Convert ordinal prices to USD using cached data
async function convertToUSD(supabaseClient: any, ordinalData: Array<any>, useCoinGecko = false) {
  let bitcoinPrices = new Map();

  if (ordinalData.length > 0) {
    const minDay = ordinalData[0].day;
    const maxDay = ordinalData[ordinalData.length - 1].day;

    // First try cached prices
    bitcoinPrices = await getCachedBitcoinPrices(supabaseClient, minDay, maxDay);

    // Fallback to embedded data and CoinGecko if needed
    if (bitcoinPrices.size === 0 && useCoinGecko) {
      const coinGeckoData = await fetchCoinGeckoData(minDay, maxDay);
      bitcoinPrices = coinGeckoData;
    }
  }

  return ordinalData.map(point => {
    const btcPrice = bitcoinPrices.get(point.day) ||
                    BITCOIN_PRICES[point.day] ||
                    BITCOIN_PRICES[point.day.slice(0, 7)] ||
                    null;

    return {
      ...point,
      btcPrice: btcPrice,
      usd: btcPrice ? point.btc * btcPrice : null
    };
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Initialize Supabase client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();

    // Debug tables endpoint - show all table contents
    if (endpoint === 'debug-tables') {
      // Query each table
      const { data: collections } = await supabaseClient
        .from('collections')
        .select('*')
        .order('id');

      const { data: collectionPrices } = await supabaseClient
        .from('collection_prices')
        .select('*')
        .order('collection_id, date')
        .limit(20);

      const { data: collectionAnalytics } = await supabaseClient
        .from('collection_analytics')
        .select('*')
        .order('collection_id');

      const { data: bitcoinPrices } = await supabaseClient
        .from('bitcoin_prices')
        .select('*')
        .order('date')
        .limit(10);

      return new Response(
        JSON.stringify({
          success: true,
          tables: {
            collections: {
              count: collections?.length || 0,
              data: collections
            },
            collection_prices: {
              count: collectionPrices?.length || 0,
              sample: collectionPrices
            },
            collection_analytics: {
              count: collectionAnalytics?.length || 0,
              data: collectionAnalytics
            },
            bitcoin_prices: {
              count: bitcoinPrices?.length || 0,
              sample: bitcoinPrices
            }
          }
        }, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in debug-tables:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        tables: {}
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }

  // Log incoming request for debugging
  console.log(`${req.method} ${req.url}`);

  try {
    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();

    // Collections endpoint - Use analytics table as primary source
    if (endpoint === 'collections') {
      const hiscores = url.searchParams.get('hiscores') === 'true';
      const limit = parseInt(url.searchParams.get('limit') || '20');

      // Query analytics table directly with JOIN to get collection metadata
      const { data: analyticsData, error } = await supabaseClient
        .from('collection_analytics')
        .select(`
          collection_id,
          total_points,
          trend_gradient,
          upward_trend,
          last_calculated,
          avg_usd,
          min_usd,
          max_usd,
          date_range_start,
          date_range_end,
          collections!inner(
            slug,
            name,
            last_updated
          )
        `)
        .gte('total_points', 10)
        .order('trend_gradient', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Analytics query error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
            collections: [],
            count: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      if (!analyticsData || analyticsData.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            collections: [],
            count: 0,
            message: "No collections with sufficient analytics data found."
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform the data for frontend
      const result = analyticsData.map(item => ({
        id: item.collection_id,
        slug: item.collections.slug,
        name: item.collections.name || item.collections.slug?.toUpperCase() || 'Unknown',
        last_updated: item.collections.last_updated,
        collection_analytics: {
          total_points: item.total_points,
          trend_gradient: item.trend_gradient,
          upward_trend: item.upward_trend,
          last_calculated: item.last_calculated,
          avg_usd: item.avg_usd,
          min_usd: item.min_usd,
          max_usd: item.max_usd,
          date_range_start: item.date_range_start,
          date_range_end: item.date_range_end
        }
      }));

      return new Response(
        JSON.stringify({
          success: true,
          collections: result,
          count: result?.length || 0,
          ...(hiscores && {
            criteria: {
              sorted_by: 'trend_gradient DESC'
            }
          })
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Collection data endpoint
    if (endpoint === 'collection' || url.searchParams.has('slug')) {
      const slug = url.searchParams.get('slug');
      const useCoinGecko = url.searchParams.get('useCoinGecko') === 'true';
      const format = url.searchParams.get('format'); // 'csv' for CSV export

      if (!slug) {
        return new Response(
          JSON.stringify({ success: false, error: 'Slug parameter required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`Fetching data for collection: ${slug}`);

      // Check if we have recent cached data first (within 24 hours)
      let { data: cachedCollection } = await supabaseClient
        .from('collections')
        .select(`
          id,
          name,
          description,
          logo_url,
          first_inscription_date,
          last_updated,
          collection_analytics(*)
        `)
        .eq('slug', slug)
        .single();

      let ordinalData = [];
      let collectionInfo = {};

      // Check if cache is fresh (less than 24 hours old)
      const cacheIsStale = !cachedCollection ||
        !cachedCollection.last_updated ||
        (Date.now() - new Date(cachedCollection.last_updated).getTime()) > 24 * 60 * 60 * 1000;

      if (cacheIsStale) {
        // Fetch fresh data from BestInSlot
        console.log('Cache stale, fetching fresh data from BestInSlot...');

        // Fetch collection info
        console.log(`🌐 Fetching collection info for: ${slug}`);
        const infoResponse = await fetch(`https://api.bestinslot.xyz/v3/collection/info?slug=${encodeURIComponent(slug)}`);

        console.log(`📡 BestInSlot info API response status: ${infoResponse.status}`);

        if (infoResponse.ok) {
          collectionInfo = await infoResponse.json();
          console.log(`✅ Collection info fetched successfully:`, JSON.stringify(collectionInfo, null, 2));
        } else {
          console.log(`❌ Failed to fetch collection info. Status: ${infoResponse.status}`);
          const errorText = await infoResponse.text();
          console.log(`❌ Error response: ${errorText}`);
        }

        // Fetch price data
        const bestInSlotUrl = `https://v2api.bestinslot.xyz/collection/chart?slug=${encodeURIComponent(slug)}`;
        const response = await fetch(bestInSlotUrl);
        const rawData = await response.json();

        // Parse and process data
        ordinalData = parseBestInSlotData(rawData);

        // Cache the fresh data for future use
        console.log('💾 Caching fresh collection data...');
        const collectionId = await cacheCollectionData(supabaseClient, slug, collectionInfo, ordinalData);

        if (collectionId) {
          console.log(`✅ Collection cached with ID: ${collectionId}`);
          // Update cachedCollection so analytics can be stored
          const { data: newCachedCollection } = await supabaseClient
            .from('collections')
            .select('id, name, description, logo_url')
            .eq('id', collectionId)
            .single();
          cachedCollection = newCachedCollection;
        } else {
          console.error('❌ Failed to cache collection');
        }
      } else {
        // Use cached data
        console.log('Using cached data...');
        const { data: cachedPrices } = await supabaseClient
          .from('collection_prices')
          .select('date, btc_price, usd_price')
          .eq('collection_id', cachedCollection.id)
          .order('date');

        ordinalData = cachedPrices?.map(row => ({
          day: row.date,
          btc: row.btc_price,
          date: new Date(row.date)
        })) || [];

        collectionInfo = {
          name: cachedCollection.name,
          description: cachedCollection.description,
          logo: cachedCollection.logo_url
        };

        // Ensure collection is in collections table for hiscores (even if using cached data)
        // This handles the case where cached data exists but collection isn't in collections table
        const { data: collectionExists } = await supabaseClient
          .from('collections')
          .select('id')
          .eq('slug', slug)
          .single();

        if (!collectionExists) {
          console.log('💾 Adding cached collection to collections table for hiscores...');
          const collectionId = await cacheCollectionData(supabaseClient, slug, collectionInfo, ordinalData);
          if (collectionId) {
            console.log(`✅ Collection added to collections table with ID: ${collectionId}`);
            // Update cachedCollection reference
            const { data: newCachedCollection } = await supabaseClient
              .from('collections')
              .select('id, name, description, logo_url')
              .eq('id', collectionId)
              .single();
            cachedCollection = newCachedCollection;
          }
        }
      }

      // Analytics calculation will happen after USD conversion below

      // Apply 3-month minimum age filter (temporarily disabled for debugging)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

      console.log(`📅 Age check: Collection first data: ${ordinalData.length > 0 ? ordinalData[0].day : 'none'}, 3 months ago: ${threeMonthsAgoStr}`);

      // Temporarily commenting out age restriction for debugging
      // if (ordinalData.length > 0 && ordinalData[0].day > threeMonthsAgoStr) {
      //   return new Response(
      //     JSON.stringify({
      //       success: false,
      //       error: 'Collection must be at least 3 months old to be analyzed'
      //     }),
      //     {
      //       status: 400,
      //       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      //     }
      //   );
      // }

      const usdData = await convertToUSD(supabaseClient, ordinalData, useCoinGecko);

      // Always calculate analytics for both fresh and cached data to ensure latest gradient
      let analyticsResult = null;
      if (ordinalData.length > 0 && usdData.length > 0) {
        console.log(`🚀 Calculating analytics for ${slug} directly from USD data`);
        console.log(`   - USD Data length: ${usdData.length}`);
        console.log(`   - USD Data valid points: ${usdData.filter(p => p.usd != null).length}`);

        // Calculate analytics directly without database dependency
        analyticsResult = await calculateAnalyticsDirectly(slug, usdData);

        if (analyticsResult && analyticsResult.success) {
          console.log(`✅ Analytics calculated successfully for ${slug}:`, analyticsResult.analytics);

          // Store gradient in collection_analytics table for hiscores
          if (cachedCollection) {
            const { error: analyticsError } = await supabaseClient
              .from('collection_analytics')
              .upsert({
                collection_id: cachedCollection.id,
                total_points: analyticsResult.analytics.total_points,
                date_range_start: analyticsResult.analytics.date_range_start,
                date_range_end: analyticsResult.analytics.date_range_end,
                min_usd: analyticsResult.analytics.min_usd,
                max_usd: analyticsResult.analytics.max_usd,
                avg_usd: analyticsResult.analytics.avg_usd,
                trend_gradient: analyticsResult.analytics.trend_gradient,
                upward_trend: analyticsResult.analytics.upward_trend,
                last_calculated: new Date().toISOString()
              }, { onConflict: 'collection_id' });

            if (analyticsError) {
              console.error('❌ Failed to store analytics:', analyticsError);
            } else {
              console.log('✅ Analytics stored successfully for hiscores');
            }
          }
        } else {
          console.error(`❌ Analytics calculation failed for ${slug}:`, analyticsResult?.error || 'Unknown error');
        }
      }

      const validPoints = usdData.filter((p: any) => p.usd != null);
      const missingPoints = usdData.length - validPoints.length;

      // Return CSV format if requested
      if (format === 'csv') {
        const csvRows = ['day,btc,usd,btc_usd_px'];
        usdData.forEach((p: any) => {
          csvRows.push(`${p.day},${p.btc},${p.usd || ''},${p.btcPrice || ''}`);
        });

        const csvContent = csvRows.join('\n');

        return new Response(csvContent, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${slug}_usd_timeseries.csv"`
          }
        });
      }

      // Calculate statistics
      const usdValues = validPoints.map((p: any) => p.usd);
      const stats: any = {
        totalPoints: validPoints.length,
        missingPoints: missingPoints,
        minUsd: usdValues.length ? Math.min(...usdValues) : 0,
        maxUsd: usdValues.length ? Math.max(...usdValues) : 0,
        avgUsd: usdValues.length ? usdValues.reduce((a: number, b: number) => a + b, 0) / usdValues.length : 0,
        dateRange: {
          start: ordinalData.length ? ordinalData[0].day : null,
          end: ordinalData.length ? ordinalData[ordinalData.length - 1].day : null
        }
      };

      // Add analytics data - prioritize fresh calculations over cached data
      if (analyticsResult && analyticsResult.success) {
        console.log(`📊 Adding analytics to stats response:`, analyticsResult.analytics);
        stats.trend_gradient = analyticsResult.analytics.trend_gradient;
        stats.stability_score = analyticsResult.analytics.stability_score;
        stats.upward_trend = analyticsResult.analytics.upward_trend;
        stats.analytics_status = 'calculated';
      } else if (cachedCollection && cachedCollection.collection_analytics && cachedCollection.collection_analytics.length > 0) {
        console.log(`📊 Using cached analytics for stats response`);
        const analytics = cachedCollection.collection_analytics[0];
        stats.trend_gradient = analytics.trend_gradient;
        stats.stability_score = analytics.stability_score;
        stats.upward_trend = analytics.upward_trend;
        stats.analytics_status = 'cached';
      } else {
        console.log(`⚠️ No analytics available for ${slug}`);
        if (analyticsResult && !analyticsResult.success) {
          stats.analytics_error = analyticsResult.error;
        }
        stats.analytics_status = 'unavailable';
      }

      return new Response(
        JSON.stringify({
          success: true,
          slug: slug,
          data: usdData,
          stats: stats
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Bitcoin prices endpoint
    if (endpoint === 'bitcoin-prices') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');

      let data = BITCOIN_PRICES;

      if (start || end) {
        const filteredData: Record<string, number> = {};
        for (const [date, price] of Object.entries(BITCOIN_PRICES)) {
          if (start && date < start) continue;
          if (end && date > end) continue;
          filteredData[date] = price;
        }
        data = filteredData;
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: data,
          count: Object.keys(data).length
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Debug database endpoint
    if (endpoint === 'debug-db') {
      const { data: collections } = await supabaseClient
        .from('collections')
        .select(`
          id,
          slug,
          name,
          last_updated,
          collection_analytics (
            total_points,
            trend_gradient,
            upward_trend,
            last_calculated,
            avg_usd,
            date_range_start,
            date_range_end
          )
        `)
        .limit(10);

      return new Response(
        JSON.stringify({
          success: true,
          collections: collections || [],
          count: collections?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clear cache endpoint (for debugging)
    if (endpoint === 'clear-cache') {
      console.log('🗑️ Clearing all cached data...');

      // Clear all cache tables
      const { error: collectionsError } = await supabaseClient.from('collections').delete().neq('id', 0);
      const { error: pricesError } = await supabaseClient.from('collection_prices').delete().neq('id', 0);
      const { error: analyticsError } = await supabaseClient.from('collection_analytics').delete().neq('id', 0);
      const { error: bitcoinError } = await supabaseClient.from('bitcoin_prices').delete().neq('id', 0);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Cache cleared',
          errors: {
            collections: collectionsError?.message || null,
            prices: pricesError?.message || null,
            analytics: analyticsError?.message || null,
            bitcoin: bitcoinError?.message || null
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hiscores endpoint - redirect to collections endpoint for frontend filtering
    if (endpoint === 'hiscores') {
      const limit = parseInt(url.searchParams.get('limit') || '10');

      console.log(`🏆 Redirecting to collections endpoint for hiscores (limit: ${limit})`);

      // Simply redirect to collections endpoint
      const collectionsUrl = new URL(req.url);
      collectionsUrl.pathname = collectionsUrl.pathname.replace('/hiscores', '/collections');

      return await fetch(collectionsUrl.toString());
    }

    // Debug analytics test endpoint
    if (endpoint === 'debug-analytics') {
      console.log('🐛 Running analytics debug test...');

      // Test with hardcoded data
      const testData = [
        { day: '2024-01-01', usd: 100 },
        { day: '2024-01-02', usd: 110 },
        { day: '2024-01-03', usd: 120 },
        { day: '2024-01-04', usd: 115 },
        { day: '2024-01-05', usd: 130 },
        { day: '2024-01-06', usd: 140 }
      ];

      // Test collection caching
      const testCollectionId = await cacheCollectionData(supabaseClient, 'test-debug', { name: 'Debug Test' }, testData);
      console.log('Test collection ID:', testCollectionId);

      if (testCollectionId) {
        // Test analytics calculation
        const analyticsResult = await calculateAndStoreAnalytics(supabaseClient, testCollectionId, testData);
        console.log('Analytics result:', analyticsResult);

        return new Response(
          JSON.stringify({
            success: true,
            collectionId: testCollectionId,
            analyticsResult: analyticsResult,
            testData: testData
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Collection caching failed',
            testData: testData
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Health check endpoint
    if (endpoint === 'health') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'BestInSlot USD Tracker API is running',
          timestamp: new Date().toISOString(),
          bitcoinDataPoints: Object.keys(BITCOIN_PRICES).length
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Default response
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid endpoint',
        availableEndpoints: [
          '/price-api?slug=collection-slug',
          '/price-api/bitcoin-prices',
          '/price-api/hiscores',
          '/price-api/health'
        ]
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error(`Error:`, error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})