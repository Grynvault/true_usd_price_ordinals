import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Slug parameter required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the data from the collection endpoint
    const collectionUrl = new URL('/functions/v1/collection', req.url);
    collectionUrl.searchParams.set('slug', slug);
    collectionUrl.searchParams.set('useCoinGecko', 'true'); // Use CoinGecko for CSV downloads

    const response = await fetch(collectionUrl.toString());
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch collection data');
    }

    // Generate CSV
    const csvRows = ['day,btc,usd,btc_usd_px'];
    result.data.forEach((p: any) => {
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

  } catch (error) {
    console.error(`CSV export error:`, error.message);
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