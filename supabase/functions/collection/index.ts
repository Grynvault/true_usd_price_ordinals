import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { BITCOIN_PRICES } from '../_shared/bitcoin-data.ts'

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
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const useCoinGecko = url.searchParams.get('useCoinGecko') === 'true';

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