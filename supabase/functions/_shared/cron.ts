// Daily cron job configuration for Bitcoin price caching
// This should be called by a cron service like GitHub Actions or Vercel Cron

export const DAILY_BITCOIN_CACHE_CRON = {
  schedule: '0 2 * * *', // Every day at 2 AM UTC
  timezone: 'UTC',
  function_name: 'bitcoin-price-cache',
  description: 'Cache daily Bitcoin prices from CoinGecko'
}

// Weekly collection analytics refresh
export const WEEKLY_ANALYTICS_REFRESH = {
  schedule: '0 3 * * 0', // Every Sunday at 3 AM UTC
  timezone: 'UTC',
  function_name: 'collection-analytics-refresh',
  description: 'Refresh analytics for all cached collections'
}