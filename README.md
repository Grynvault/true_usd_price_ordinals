
# BestInSlot USD Tracker — v5.1

🚀 **Web App** • 📊 **Interactive Charts** • 💾 **CSV Export** • 🔗 **Real-time API**

Convert BestInSlot ordinal prices to USD using historical Bitcoin price data. Multiple interfaces available: **Web App**, **CLI Tool**, and **Browser Extension**.

## 🌐 Web Application (Recommended)

### Quick Start
```bash
# Install and run
npm install
npm start

# Open in browser
http://127.0.0.1:3000
```

### Features
- ✅ **Clean web interface** with modern UI
- ✅ **Interactive charts** with Chart.js
- ✅ **Real-time data** from BestInSlot API
- ✅ **USD/BTC toggle views**
- ✅ **Statistics dashboard**
- ✅ **One-click CSV export**
- ✅ **Popular collections** quick access
- ✅ **Embedded Bitcoin data** (2024-2025, 475+ price points)

### Usage
1. Enter any BestInSlot collection slug (e.g., "wizards", "nodemonkes")
2. Click "Load Collection"
3. View interactive chart with price history
4. Download CSV with complete data
5. Toggle between USD and BTC price views

### API Endpoints
- `GET /api/collection/:slug` - Get collection USD data
- `GET /api/collection/:slug/csv` - Download CSV export
- `GET /api/bitcoin-prices` - Get Bitcoin historical prices
- `GET /api/health` - API health check

## 💻 CLI Tool

**Quick Usage**
```bash
# Basic usage
npm run cli wizards "Bitcoin Historical Data JUL 14 2025.csv"

# With CoinGecko gap filling
npm run cli wizards "Bitcoin Historical Data JUL 14 2025.csv" --use-coingecko

# Test with sample data
npm test
```

## 🔗 Browser Extension

**Installation**
- Chrome: Load unpacked extension from this directory
- Firefox: Load temporary add-on from `manifest.json`
- Navigate to BestInSlot collection pages for automatic integration

## 🎯 Which Interface to Use?

| Interface | Best For | Features |
|-----------|----------|----------|
| **Web App** | Most users, analysis | Interactive charts, modern UI, real-time data |
| **CLI Tool** | Automation, batch processing | Terminal usage, CSV generation, scripting |
| **Browser Extension** | BestInSlot browsing | On-page integration, contextual data |

## 📊 Supported Collections

Works with **any** BestInSlot collection:
- **wizards** - Quantum Cats
- **nodemonkes** - NodeMonkes
- **bitcoin-puppets** - Bitcoin Puppets
- **ordinal-maxi-biz** - Ordinal Maxi Biz
- ...and hundreds more!

## 🔮 Future Plans

**Near-term**: Convert embedded Bitcoin data to API for real-time updates
**Long-term**: Multiple cryptocurrencies, portfolio tracking, price alerts
