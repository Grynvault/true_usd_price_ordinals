import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting Bitcoin price cache update...')

    // Check when we last updated Bitcoin prices
    const { data: latestPrice } = await supabaseClient
      .from('bitcoin_prices')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)

    const today = new Date().toISOString().split('T')[0]
    const lastCachedDate = latestPrice?.[0]?.date

    // Only fetch if we don't have today's price yet
    if (lastCachedDate === today) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Bitcoin prices already up to date',
        lastCachedDate
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Calculate date range to fetch (last cached date to today)
    const startDate = lastCachedDate
      ? new Date(new Date(lastCachedDate).getTime() + 24 * 60 * 60 * 1000) // Next day after last cached
      : new Date('2020-01-01') // Default start if no cache

    const endDate = new Date()

    // Fetch from CoinGecko
    const fromUnix = Math.floor(startDate.getTime() / 1000)
    const toUnix = Math.floor(endDate.getTime() / 1000)

    console.log(`Fetching Bitcoin prices from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    const coinGeckoUrl = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromUnix}&to=${toUnix}`
    const response = await fetch(coinGeckoUrl)
    const data = await response.json()

    if (data.error) {
      throw new Error(`CoinGecko API Error: ${data.error}`)
    }

    // Process and batch insert prices
    const pricesToInsert = []
    const processedDates = new Set()

    for (const [timestamp, price] of (data.prices || [])) {
      const date = new Date(timestamp).toISOString().split('T')[0]

      // Only keep the latest price for each date
      if (!processedDates.has(date)) {
        processedDates.add(date)
        pricesToInsert.push({
          date,
          price: parseFloat(price.toFixed(2)),
          source: 'coingecko'
        })
      }
    }

    console.log(`Inserting ${pricesToInsert.length} Bitcoin price records...`)

    // Batch insert with upsert
    const { error: insertError } = await supabaseClient
      .from('bitcoin_prices')
      .upsert(pricesToInsert, { onConflict: 'date' })

    if (insertError) {
      throw new Error(`Database insert error: ${insertError.message}`)
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully cached ${pricesToInsert.length} Bitcoin price records`,
      dateRange: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Bitcoin price cache error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})