# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-platform Bitcoin ordinals USD price tracker that converts BestInSlot ordinal prices to USD using historical Bitcoin price data. Supports browser extension, CLI tool, web app, and serverless API deployments.

## Architecture

**Multi-Platform Structure**:
- **Browser Extension**: `content.js` + `manifest.json` - Single-file extension for bestinslot.xyz
- **CLI Tool**: `cli.js` - Command-line interface for batch processing
- **Web App**: `public/` directory - Static frontend with Chart.js visualization
- **Express Server**: `server.js` - Local development server with API endpoints
- **Supabase Functions**: `supabase/functions/` - Serverless Deno/TypeScript edge functions

**Core Data Flow**:
1. Extract collection slug from URL or input
2. Fetch BTC ordinal prices from `v2api.bestinslot.xyz/collection/chart?slug={slug}`
3. Convert to USD using:
   - Embedded Bitcoin price data (`bitcoin-data.js`)
   - CoinGecko API for recent data gaps
   - User-uploaded CSV/JSON files (extension only)
4. Output as charts, CSV exports, or JSON API responses

**Key Components**:
- `content.js`: Browser extension core logic with DOM injection
- `public/app.js`: Web app frontend with Chart.js integration
- `supabase/functions/price-api/index.ts`: Main serverless API endpoint
- `bitcoin-data.js`: Shared Bitcoin historical price dataset
- `cli.js`: Command-line processing with file I/O

## Development Commands

**Local Development**:
```bash
# Start web app development server
npm start                 # Express server on localhost:3000
npm run dev              # Same as npm start

# CLI usage for testing/batch processing
npm test                 # Test with wizards collection
npm run cli              # Direct CLI access
npm run test-api         # Test CoinGecko API integration

# Direct CLI usage
node cli.js <slug> <btc-file> [--use-coingecko]
node test-coingecko.js   # Test external APIs
```

**Supabase Development** (for serverless functions):
```bash
# Start local Supabase stack
supabase start           # PostgreSQL + Edge Functions on localhost:54321

# Deploy functions locally
supabase functions deploy price-api --local

# Deploy to production
supabase functions deploy price-api

# View function logs
supabase functions logs price-api
```

**Browser Extension**:
- Chrome: Load unpacked from project root in `chrome://extensions/`
- Firefox: Load temporary add-on from `manifest.json`
- Test on `bestinslot.xyz/ordinals/collections/{slug}` pages

**Static Deployment**:
```bash
# Deploy public/ folder to Netlify/Vercel/GitHub Pages
cd public && python3 -m http.server 8000  # Local testing
```

## API Endpoints

**Local Development** (Express server):
```
GET /api/collection/:slug      # Collection data with USD conversion
GET /api/bitcoin-prices        # Bitcoin historical price data
GET /                         # Static web app
```

**Supabase Functions** (production):
```
GET /functions/v1/price-api/?slug={slug}                    # Collection data
GET /functions/v1/price-api/?slug={slug}&useCoinGecko=true  # With CoinGecko
GET /functions/v1/price-api/?slug={slug}&format=csv         # CSV download
GET /functions/v1/price-api/bitcoin-prices                  # Bitcoin prices
GET /functions/v1/price-api/health                         # Health check
```

**External APIs**:
```
BestInSlot: https://v2api.bestinslot.xyz/collection/chart?slug={slug}
CoinGecko: https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range
```

## File Format Support

**CSV**: Auto-detects Date/Price column order, flexible headers (`date,close`, `day,price`)
**JSON**: Arrays of `[price, date]` pairs or keyed objects with daily/monthly timestamps

## Architecture Patterns

**Shared Bitcoin Data**: `bitcoin-data.js` contains historical BTC/USD prices used across all platforms
**CORS Handling**: Consistent headers across Express server and Supabase functions
**Date Normalization**: Unified `dayKey()` function for YYYY-MM-DD date formatting
**Error Handling**: Graceful fallbacks when APIs are unavailable
**Multi-format Output**: JSON responses + CSV exports for data portability