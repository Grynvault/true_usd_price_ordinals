# BestInSlot USD Tracker - Web App

## 🚀 Quick Start

### Prerequisites
- **Node.js** 14.0.0 or higher
- **npm** or **yarn**

### Installation & Running
```bash
# Install dependencies
npm install

# Start the web app
npm start

# Open in browser
# http://127.0.0.1:3000
```

## 📱 Web App Features

### 🎯 **Main Interface**
- **Clean, modern UI** with gradient background
- **Search bar** for any BestInSlot collection slug
- **Popular collection tags** for quick access
- **Real-time status messages** with loading indicators

### 📊 **Interactive Dashboard**
- **Statistics cards** showing:
  - Total data points
  - Min/Max/Average USD prices
  - Date range coverage
  - Missing data points
- **Professional chart display** with Chart.js
- **Toggle between USD/BTC views**
- **Interactive tooltips** with detailed price info

### 💾 **Data Export**
- **One-click CSV download** with full price data
- **Format**: `day,btc,usd,btc_usd_px`
- **Automatic file naming**: `{collection}_usd_timeseries.csv`

### 🔗 **API Integration**
- **Real-time BestInSlot API** fetching
- **Embedded Bitcoin price data** (2024-2025)
- **Error handling** with user-friendly messages
- **CORS enabled** for development

## 🛠 API Endpoints

### Collection Data
```http
GET /api/collection/:slug
```
**Example**: `/api/collection/wizards`

**Response**:
```json
{
  "success": true,
  "slug": "wizards",
  "data": [
    {
      "day": "2024-02-22",
      "btc": 0.0124,
      "date": "2024-02-22T00:00:00.000Z",
      "btcPrice": 51000,
      "usd": 632.4
    }
  ],
  "stats": {
    "totalPoints": 509,
    "missingPoints": 64,
    "minUsd": 0.51,
    "maxUsd": 3.18,
    "avgUsd": 1.23,
    "dateRange": {
      "start": "2024-02-22",
      "end": "2025-09-16"
    }
  }
}
```

### CSV Export
```http
GET /api/collection/:slug/csv
```
**Example**: `/api/collection/wizards/csv`

Downloads CSV file directly.

### Bitcoin Prices
```http
GET /api/bitcoin-prices?start=2024-01-01&end=2024-12-31
```

**Response**:
```json
{
  "success": true,
  "data": {
    "2024-01-01": 44000,
    "2024-01-02": 44000
  },
  "count": 400
}
```

### Health Check
```http
GET /api/health
```

**Response**:
```json
{
  "success": true,
  "message": "BestInSlot USD Tracker API is running",
  "timestamp": "2025-09-17T01:00:00.000Z",
  "bitcoinDataPoints": 400
}
```

## 🏗 Architecture

### **Frontend** (`/public/`)
- **index.html**: Single-page application
- **styles.css**: Modern responsive design with gradients
- **app.js**: Vanilla JavaScript with Chart.js integration

### **Backend** (`server.js`)
- **Express.js** web server
- **API routes** for data fetching and CSV export
- **Static file serving** for frontend assets
- **HTTPS integration** for external APIs

### **Data Layer**
- **bitcoin-data.js**: Embedded Bitcoin price data (2024-2025)
- **BestInSlot API**: Real-time ordinal price fetching
- **CoinGecko API**: Future integration for recent prices

## 📈 Usage Examples

### Basic Usage
1. **Open** `http://127.0.0.1:3000`
2. **Enter collection slug** (e.g., "wizards")
3. **Click "Load Collection"**
4. **View interactive chart** and statistics
5. **Download CSV** if needed

### Popular Collections
- **wizards** - Quantum Cats collection
- **nodemonkes** - NodeMonkes collection
- **bitcoin-puppets** - Bitcoin Puppets
- **ordinal-maxi-biz** - Ordinal Maxi Biz

### API Usage
```bash
# Get collection data
curl http://127.0.0.1:3000/api/collection/wizards

# Download CSV
curl http://127.0.0.1:3000/api/collection/wizards/csv -o wizards_data.csv

# Check API health
curl http://127.0.0.1:3000/api/health
```

## 🔧 Development

### File Structure
```
bestinslot-usd-v5_1/
├── server.js                 # Express.js server
├── bitcoin-data.js          # Embedded Bitcoin data
├── cli.js                   # Command-line tool
├── package.json             # Dependencies & scripts
│
├── public/                  # Frontend assets
│   ├── index.html          # Main web interface
│   ├── styles.css          # Responsive CSS design
│   └── app.js              # Frontend JavaScript
│
└── docs/                    # Documentation
    ├── WEBAPP.md           # This web app guide
    ├── README.md           # Project overview
    └── INSTALLATION.md     # Setup instructions
```

### Development Scripts
```bash
# Start web app
npm start

# Run CLI tool
npm run cli wizards "Bitcoin Historical Data JUL 14 2025.csv"

# Test CLI with CoinGecko
npm test

# Test API integration
npm run test-api
```

### Adding New Collections
No setup needed - any BestInSlot collection slug works automatically:
- Navigate to `bestinslot.xyz/ordinals/collections/{collection-name}`
- Copy the collection name from URL
- Use it in the web app

## 🚢 Deployment Options

### Local Development
```bash
npm start
# Access at http://127.0.0.1:3000
```

### Production Deployment
```bash
# Option 1: PM2 Process Manager
npm install -g pm2
pm2 start server.js --name "bestinslot-tracker"

# Option 2: Docker (create Dockerfile)
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# Option 3: Cloud platforms (Heroku, Railway, etc.)
# Just push the repo - package.json configures everything
```

### Environment Variables
```bash
# Optional: Customize port
PORT=3000

# Optional: Node environment
NODE_ENV=production
```

## 🔮 Future Enhancements

### **Near-term** (Convert embedded data to API)
- **Real-time Bitcoin price updates** via API
- **Extended historical data** (2010-present)
- **Multiple cryptocurrency support** (ETH, etc.)

### **Long-term**
- **User accounts** and saved collections
- **Price alerts** and notifications
- **Portfolio tracking** across multiple collections
- **Mobile app** with React Native
- **Advanced analytics** with trend analysis

## 🐛 Troubleshooting

### Common Issues
1. **"Module not found"**: Run `npm install` first
2. **Port 3000 in use**: Change PORT in server.js or kill other processes
3. **API errors**: Check network connection and BestInSlot API status
4. **Chart not loading**: Verify Chart.js CDN is accessible

### Debugging
```bash
# Check API health
curl http://127.0.0.1:3000/api/health

# View server logs
npm start

# Test specific collection
curl "http://127.0.0.1:3000/api/collection/wizards" | jq
```

### Performance
- **Bitcoin data**: ~400 price points embedded for fast loading
- **Chart rendering**: Optimized with Canvas and efficient data structures
- **API caching**: Consider adding Redis for high-traffic deployments
- **CDN**: Chart.js loaded from CDN for better performance

## 📞 Support

- **GitHub Issues**: Report bugs and feature requests
- **API Documentation**: `/api/health` endpoint for status
- **Browser Console**: Check for JavaScript errors
- **Network Tab**: Monitor API request/response cycles