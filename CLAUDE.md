# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome/Firefox browser extension that adds USD price tracking capabilities to BestInSlot.xyz collection pages. It fetches Bitcoin ordinal price data from the BestInSlot API and converts it to USD using either user-uploaded historical BTC/USD data or CoinGecko API for gap filling.

## Architecture

**Single-file Extension**: The entire functionality is contained in `content.js` (13KB), injected into bestinslot.xyz pages via manifest v3.

**Core Data Flow**:
1. Extracts collection slug from URL path (`/ordinals/collections/{slug}`)
2. Fetches BTC-denominated price data from `v2api.bestinslot.xyz/collection/chart?slug={slug}`
3. Maps to USD using either:
   - User-uploaded historical BTCUSD data (CSV/JSON, stored in localStorage)
   - CoinGecko API (`api.coingecko.com/api/v3/coins/bitcoin/market_chart/range`) for July 15 - present
4. Renders mini chart and enables CSV export

**Key Functions**:
- `fetchBIS(slug)`: Gets ordinal price series from BestInSlot API
- `fetchCG(fromDay, toDay)`: Gets BTC/USD prices from CoinGecko for date range
- `loadFileToTable(file, cb)`: Robust parser for CSV/JSON BTCUSD data with auto-detection
- `parseBIS(j)`: Normalizes BestInSlot API response to daily {day, btc} points
- `drawMiniChart()`: Canvas-based price chart rendering

**Storage**: Uses localStorage for BTCUSD price table (`bis_btc_usd_table`) and preferences.

## Development Commands

**CLI Usage**:
```bash
# Basic usage
node cli.js <collection-slug> <btc-usd-csv-file> [--use-coingecko]

# Examples
node cli.js wizards "Bitcoin Historical Data JUL 14 2025.csv" --use-coingecko
node cli.js nodemonkes "Bitcoin Historical Data JUL 14 2025.csv"

# Using npm scripts
npm test  # Test with wizards collection
npm start # Show usage
```

**Browser Extension**:
- Chrome: Load unpacked extension from this directory in `chrome://extensions/`
- Firefox: Load temporary add-on from `manifest.json`
- Navigate to `bestinslot.xyz/ordinals/collections/{collection-name}`
- Upload BTCUSD data file, click "Build USD"

**Testing APIs**:
```bash
node test-coingecko.js  # Test CoinGecko API integration
```

**API Endpoints**:
- BestInSlot: `https://v2api.bestinslot.xyz/collection/chart?slug=wizards`
- CoinGecko: `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from={unix}&to={unix}`

## File Format Support

**CSV**: Auto-detects Date/Price column order, accepts headers like `date,close` or `day,price`
**JSON**: Supports arrays of `[price, date]` or `[date, price]` pairs, plus keyed objects with daily/monthly keys

## Key Features

- Auto slug detection from URL changes (SPA-aware via MutationObserver)
- Flexible date parsing (supports both daily YYYY-MM-DD and monthly YYYY-MM fallbacks)
- CoinGecko integration for recent data gaps (July 15, 2025 onwards)
- Canvas-based mini chart with automatic scaling
- CSV export functionality