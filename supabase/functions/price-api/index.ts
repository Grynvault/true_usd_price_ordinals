import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
  "2025-01": 103200.0
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

// Convert ordinal prices to USD
async function convertToUSD(ordinalData: Array<any>, useCoinGecko = false) {
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();

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

      // Fetch ordinal data from BestInSlot
      const bestInSlotUrl = `https://v2api.bestinslot.xyz/collection/chart?slug=${encodeURIComponent(slug)}`;
      const response = await fetch(bestInSlotUrl);
      const rawData = await response.json();

      // Parse and process data
      const ordinalData = parseBestInSlotData(rawData);
      const usdData = await convertToUSD(ordinalData, useCoinGecko);

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
      const stats = {
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