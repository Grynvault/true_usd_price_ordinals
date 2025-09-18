# BestInSlot USD Tracker

🚀 **Full-Stack Web App** • 📊 **Interactive Charts** • 💾 **CSV Export** • 🔗 **Real-time API**

Convert BestInSlot ordinal prices to USD using historical Bitcoin price data with a modern serverless architecture.

## Architecture

- **Backend**: Supabase Edge Functions (Deno/TypeScript serverless)
- **Frontend**: React/Next.js on Netlify
- **APIs**: BestInSlot + CoinGecko integration
- **Database**: Supabase PostgreSQL (optional for future features)

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Git](https://git-scm.com/)

### 1. Clone and Setup

```bash
git clone https://github.com/Grynvault/true_usd_price_ordinals.git
cd true_usd_price_ordinals

# Install frontend dependencies
npm install
```

### 2. Start Supabase Locally

```bash
# Start Supabase local development stack
supabase start

# This will start:
# - PostgreSQL on localhost:54322
# - Supabase Studio on http://localhost:54323
# - Edge Functions on http://localhost:54321
```

### 3. Deploy Functions Locally

```bash
# Deploy the price-api function locally
supabase functions deploy price-api --local

# Verify it's working
curl "http://localhost:54321/functions/v1/price-api/health"
```

### 4. Start Frontend

```bash
# Option 1: Simple static server
cd public && python3 -m http.server 8000
# Visit: http://localhost:8000

# Option 2: Express server (development)
npm start
# Visit: http://localhost:3000
```

### 5. Test Local API

```bash
# Health check
curl "http://localhost:54321/functions/v1/price-api/health"

# Get collection data
curl "http://localhost:54321/functions/v1/price-api?slug=wizards"

# Get collection data with CoinGecko
curl "http://localhost:54321/functions/v1/price-api?slug=wizards&useCoinGecko=true"

# Download CSV
curl "http://localhost:54321/functions/v1/price-api?slug=wizards&format=csv" -o wizards.csv

# Get Bitcoin prices
curl "http://localhost:54321/functions/v1/price-api/bitcoin-prices"
```

## Deploying to Supabase

### 1. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project name: "bestinslot-usd-tracker"
5. Generate a strong database password
6. Select region (closest to your users)
7. Click "Create new project"

### 2. Link Your Project

```bash
# Link to your remote project
supabase link --project-ref YOUR_PROJECT_REF

# Your project ref is in the URL: https://YOUR_PROJECT_REF.supabase.co
```

### 3. Deploy Functions

```bash
# Deploy the price-api function to production
supabase functions deploy price-api

# Verify deployment
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/price-api/health"
```

### 4. Optional: Database Setup

If you plan to store data in Supabase (future enhancement):

```bash
# Run any database migrations
supabase db push

# View your database in Supabase Studio
# https://supabase.com/dashboard/project/YOUR_PROJECT_REF
```

## Deploying to Netlify

### 1. Prepare Frontend Configuration

Update `public/config.js` with your Supabase URLs:

```javascript
// Replace YOUR_PROJECT_REF with your actual project reference
window.SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
window.SUPABASE_FUNCTION_URL = 'https://YOUR_PROJECT_REF.functions.supabase.co';
```

### 2. Deploy to Netlify

#### Option A: Drag & Drop (Quickest)

1. Go to [netlify.com](https://netlify.com)
2. Drag the `public/` folder into the deploy area
3. Your site will be live at `https://random-name.netlify.app`

#### Option B: Git Integration (Recommended)

1. Push your code to GitHub:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. Connect to Netlify:
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub account
   - Select your repository
   - Configure build settings:
     - **Build command**: (leave empty)
     - **Publish directory**: `public`
   - Click "Deploy site"

### 3. Configure Custom Domain (Optional)

1. In Netlify dashboard, go to "Domain settings"
2. Click "Add custom domain"
3. Follow DNS configuration instructions

## Environment Variables

### For Local Development

Create `.env.local` in your project root:

```bash
# Local Supabase (when running supabase start)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
NEXT_PUBLIC_SUPABASE_FUNCTION_URL=http://localhost:54321/functions/v1
```

### For Production (Netlify)

Set these environment variables in your Netlify dashboard:

1. Go to your site settings in Netlify
2. Navigate to "Environment variables"
3. Add the following variables:

```bash
# Replace YOUR_PROJECT_REF with your actual project reference
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-dashboard
NEXT_PUBLIC_SUPABASE_FUNCTION_URL=https://YOUR_PROJECT_REF.functions.supabase.co
```

**To find your ANON KEY:**
1. Go to your Supabase project dashboard
2. Navigate to "Settings" → "API"
3. Copy the "anon public" key

### For Supabase Edge Functions (Optional)

If you need to store secrets for your functions:

```bash
# Set secrets for Edge Functions
supabase secrets set COINGECKO_API_KEY=your-api-key
supabase secrets set CUSTOM_CONFIG=your-config

# List all secrets
supabase secrets list
```

## Testing the API

### Frontend Integration

Update your frontend API calls to use the deployed Supabase function:

```javascript
// Example fetch in your React/Next.js app
const fetchCollectionData = async (slug) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_FUNCTION_URL}/price-api?slug=${slug}&useCoinGecko=true`
  );
  const data = await response.json();
  return data;
};

// CSV download
const downloadCSV = async (slug) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_FUNCTION_URL}/price-api?slug=${slug}&format=csv`
  );
  const blob = await response.blob();
  // Handle download...
};
```

### API Endpoints

Your deployed API will be available at:

```
Base URL: https://YOUR_PROJECT_REF.functions.supabase.co/price-api

GET /?slug=COLLECTION_SLUG              # Get collection data
GET /?slug=COLLECTION_SLUG&useCoinGecko=true  # With CoinGecko gap filling
GET /?slug=COLLECTION_SLUG&format=csv   # Download CSV
GET /bitcoin-prices                     # Get Bitcoin price data
GET /bitcoin-prices?start=2024-01&end=2024-12  # Filtered Bitcoin prices
GET /health                            # Health check
```

### Example API Calls

```bash
# Health check
curl "https://lfwsooldipswbvbpnoxo.functions.supabase.co/price-api/health"

# Get wizards collection data
curl "https://lfwsooldipswbvbpnoxo.functions.supabase.co/price-api?slug=wizards"

# Get data with CoinGecko gap filling
curl "https://lfwsooldipswbvbpnoxo.functions.supabase.co/price-api?slug=nodemonkes&useCoinGecko=true"

# Download CSV
curl "https://lfwsooldipswbvbpnoxo.functions.supabase.co/price-api?slug=bitcoin-puppets&format=csv" -o bitcoin-puppets.csv

# Get Bitcoin historical prices
curl "https://lfwsooldipswbvbpnoxo.functions.supabase.co/price-api/bitcoin-prices"
```

## Supported Collections

Works with **any** BestInSlot collection slug:

- **wizards** - Quantum Cats
- **nodemonkes** - NodeMonkes
- **bitcoin-puppets** - Bitcoin Puppets
- **ordinal-maxi-biz** - Ordinal Maxi Biz
- **taproot-wizards** - Taproot Wizards
- And hundreds more!

Find collection slugs at [bestinslot.xyz](https://bestinslot.xyz)

## Features

- ✅ **Real-time data** from BestInSlot API
- ✅ **Gap filling** with CoinGecko integration
- ✅ **Interactive charts** with Chart.js
- ✅ **CSV export** functionality
- ✅ **USD/BTC toggle** views
- ✅ **Statistics dashboard**
- ✅ **Responsive design**
- ✅ **Serverless architecture**
- ✅ **Free hosting** on both platforms

## Architecture Benefits

### Supabase Edge Functions
- 🌍 **Global edge deployment** - Functions run close to users
- 🚀 **Fast cold starts** - Deno runtime optimized for speed
- 🔒 **Built-in security** - CORS, rate limiting, monitoring
- 💰 **Free tier**: 500,000 function invocations/month

### Netlify Static Hosting
- ⚡ **Global CDN** - Files served from nearest edge location
- 🔄 **Instant deployments** - Deploy on every git push
- 🛡️ **DDoS protection** and SSL certificates included
- 💰 **Free tier**: 100GB bandwidth/month

## Cost Optimization

Both platforms offer generous free tiers suitable for most use cases:

**Supabase Free Tier:**
- 500,000 Edge Function invocations/month
- 500MB database storage
- Up to 5GB bandwidth

**Netlify Free Tier:**
- 100GB bandwidth/month
- 300 build minutes/month
- Unlimited sites

## Troubleshooting

### Function Deployment Issues

```bash
# Check function logs
supabase functions logs price-api

# Redeploy with verbose output
supabase functions deploy price-api --debug
```

### CORS Issues

The function includes proper CORS headers. If you still have issues:

1. Verify your frontend is calling the correct URL
2. Check browser developer tools for specific error messages
3. Ensure you're using HTTPS in production

### API Rate Limiting

- **BestInSlot API**: No known rate limits
- **CoinGecko API**: 30 calls/minute on free tier
- **Edge Functions**: 10-minute execution timeout

### Common Issues

**"Function not found"**
- Ensure you deployed the function: `supabase functions deploy price-api`
- Check the correct URL format: `https://PROJECT.functions.supabase.co/price-api`

**"CORS error"**
- Verify your frontend URL is correct
- Check that the function includes CORS headers (it should)

**"No data found"**
- Verify the collection slug exists on BestInSlot
- Check BestInSlot API directly: `https://v2api.bestinslot.xyz/collection/chart?slug=wizards`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test locally with `supabase start`
5. Submit a pull request

## Support

- 📖 [Supabase Docs](https://supabase.com/docs)
- 📖 [Netlify Docs](https://docs.netlify.com)
- 🐛 [Report Issues](https://github.com/Grynvault/true_usd_price_ordinals/issues)
- 💬 [Discussions](https://github.com/Grynvault/true_usd_price_ordinals/discussions)

## License

MIT License - feel free to use this project for your own ordinals tracking needs!

---

**🎯 Ready to deploy?** Follow the steps above and your BestInSlot USD Tracker will be live with enterprise-grade serverless infrastructure!