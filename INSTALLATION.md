# BestInSlot USD Tracker - Installation Guide

## Browser Extension Installation

### Chrome Installation
1. **Download/Clone** this repository to your computer
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top-right corner
4. **Click "Load unpacked"** and select the `bestinslot-usd-v5_1` folder
5. **Verify Installation**: You should see "BestInSlot → USD (auto-slug)" in your extensions list

### Firefox Installation
1. **Download/Clone** this repository to your computer
2. **Open Firefox** and navigate to `about:debugging`
3. **Click "This Firefox"** in the left sidebar
4. **Click "Load Temporary Add-on"**
5. **Select** the `manifest.json` file from the `bestinslot-usd-v5_1` folder
6. **Verify Installation**: The extension will be loaded temporarily

## Usage Instructions

### Browser Extension
1. **Navigate** to any BestInSlot collection page:
   - Example: `https://bestinslot.xyz/ordinals/collections/wizards`
   - Example: `https://bestinslot.xyz/ordinals/collections/nodemonkes`

2. **Extension UI**: A floating panel will appear in the bottom-right corner with:
   - Collection slug auto-detection
   - Option to use CoinGecko for recent price data
   - Three action buttons: "Build USD", "Download CSV", "View Chart"

3. **Build USD Data**:
   - Click **"Build USD"** to fetch ordinal prices and convert to USD
   - Uses embedded Bitcoin historical data (2024-2025)
   - Shows mini chart in the extension panel
   - Displays statistics (data points, missing data)

4. **View Interactive Chart**:
   - Click **"View Chart"** to open a full interactive chart in a new tab
   - Features zoom, tooltips, and detailed price information
   - Professional chart interface with statistics dashboard

5. **Download Data**:
   - Click **"Download CSV"** to export data
   - Format: `day,btc,usd,btc_usd_px`
   - Includes BTC prices, USD values, and BTC/USD exchange rates

### CLI Tool
```bash
# Basic usage
node cli.js <collection-slug> <btc-usd-csv-file> [--use-coingecko]

# Examples
node cli.js wizards "Bitcoin Historical Data JUL 14 2025.csv" --use-coingecko
node cli.js nodemonkes "Bitcoin Historical Data JUL 14 2025.csv"

# Run tests
npm test
```

### Standalone Chart Viewer
Open `chart-viewer.html` directly in your browser:
- Enter any collection slug (e.g., "wizards", "nodemonkes")
- Click "Load Chart" to fetch and display interactive price data
- Uses embedded Bitcoin historical data automatically

## Features

### ✅ What Works Now
- **Auto slug detection** from BestInSlot URLs
- **Embedded Bitcoin price data** (2024-2025, ~400 data points)
- **Interactive chart viewer** with professional UI
- **CSV data export** with detailed price information
- **Cross-browser compatibility** (Chrome, Firefox)
- **CLI tool** for batch processing
- **Real-time API integration** with BestInSlot

### 📋 Data Coverage
- **Bitcoin Historical Data**: 2024-2025 with daily resolution
- **Monthly fallbacks** for older periods (2023-12 onwards)
- **BestInSlot API**: Real-time ordinal price data
- **CoinGecko API**: Recent Bitcoin price gaps (optional)

### 🔮 Future Improvements (Noted for API Conversion)
- **Full historical Bitcoin data** (2010-present) via API
- **Real-time Bitcoin price updates**
- **Multiple currency support** (EUR, GBP, etc.)
- **Price alerts and notifications**
- **Portfolio tracking across collections**

## Troubleshooting

### Common Issues
1. **"No slug detected"**: Make sure you're on a BestInSlot collection page
2. **"No USD points"**: Bitcoin price data might be missing for that date range
3. **Chart won't load**: Check browser console for API errors
4. **Extension not visible**: Refresh the BestInSlot page after installation

### Data Limitations
- Bitcoin price data is currently embedded (faster but limited)
- CoinGecko free API has 365-day historical limit
- Some older ordinal collections may have limited price coverage

### Browser Permissions
The extension requires:
- **Storage**: To save user preferences and Bitcoin price data
- **Host permissions**: To access BestInSlot and CoinGecko APIs
- **Web accessible resources**: To open the chart viewer in new tabs

## File Structure
```
bestinslot-usd-v5_1/
├── manifest.json              # Extension manifest
├── content.js                # Main extension logic
├── bitcoin-data.js           # Embedded Bitcoin price data
├── chart-viewer.html         # Interactive chart interface
├── cli.js                    # Command-line tool
├── test-coingecko.js        # API testing utility
├── package.json             # Node.js package info
├── README.md                # Project overview
├── CLAUDE.md                # Development documentation
└── INSTALLATION.md          # This installation guide
```

## Support
- Check the browser console for error messages
- Verify you're on a valid BestInSlot collection page
- Ensure the extension has proper permissions
- Try refreshing the page if the extension UI doesn't appear