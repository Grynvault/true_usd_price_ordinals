# Deployment Guide: Supabase + Netlify

This guide walks you through deploying the BestInSlot USD Tracker with **backend on Supabase** and **frontend on Netlify**.

## Architecture

- **Frontend**: Static site deployed to Netlify
- **Backend**: Supabase Edge Functions (serverless)
- **API Endpoints**:
  - Collection data: `https://your-project.supabase.co/functions/v1/collection`
  - CSV export: `https://your-project.supabase.co/functions/v1/csv-export`

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Supabase Account](https://supabase.com)
- [Netlify Account](https://netlify.com)

## Step 1: Deploy to Supabase

### 1.1 Install Supabase CLI
```bash
npm install -g supabase
```

### 1.2 Login to Supabase
```bash
supabase login
```

### 1.3 Create new Supabase project
```bash
# Go to https://supabase.com/dashboard
# Click "New Project"
# Note your project URL: https://YOUR-PROJECT.supabase.co
```

### 1.4 Link to your project
```bash
supabase link --project-ref YOUR-PROJECT-REF
```

### 1.5 Deploy Edge Functions
```bash
# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy collection
supabase functions deploy csv-export
```

### 1.6 Test your functions
```bash
# Test collection endpoint
curl "https://YOUR-PROJECT.supabase.co/functions/v1/collection?slug=wizards"

# Test CSV export
curl "https://YOUR-PROJECT.supabase.co/functions/v1/csv-export?slug=wizards"
```

## Step 2: Deploy Frontend to Netlify

### 2.1 Update Supabase URL
Edit `public/config.js`:
```javascript
// Replace with your actual project URL
window.SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
```

### 2.2 Deploy to Netlify
#### Option A: Git Integration (Recommended)
1. Push your code to GitHub
2. Connect Netlify to your repo
3. Build settings:
   - **Build command**: (leave empty)
   - **Publish directory**: `public`

#### Option B: Manual Deploy
1. Drag and drop the `public/` folder to Netlify

### 2.3 Configure Custom Domain (Optional)
- Add your custom domain in Netlify dashboard
- Update CORS settings if needed

## Step 3: Environment Variables

### For Supabase Edge Functions (if needed)
```bash
supabase secrets set API_KEY=your-api-key
```

### For local development
Create `.env.local`:
```bash
SUPABASE_URL=http://localhost:54321
```

## Step 4: Local Development

### Backend (Supabase)
```bash
# Start Supabase local development
supabase start

# Your functions will be available at:
# http://localhost:54321/functions/v1/collection
# http://localhost:54321/functions/v1/csv-export
```

### Frontend
```bash
# Update config.js for local development
window.SUPABASE_URL = 'http://localhost:54321';

# Serve the public directory
cd public
python3 -m http.server 8000
# Open http://localhost:8000
```

## Step 5: Production URLs

Once deployed, your app will be available at:

- **Frontend**: `https://your-site.netlify.app`
- **API**: `https://your-project.supabase.co/functions/v1/`

### Pretty URLs with Netlify redirects
The included `netlify.toml` provides:
- `https://your-site.netlify.app/wizards` → loads wizards collection
- `https://your-site.netlify.app/ordinals/collections/wizards`

## Troubleshooting

### CORS Issues
Make sure your Supabase functions return proper CORS headers:
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}
```

### Function Errors
Check Supabase function logs:
```bash
supabase functions logs collection
```

### API Timeouts
Edge functions have a 10-minute timeout limit. For long-running operations, consider async processing.

## Cost Optimization

### Supabase Free Tier
- 500,000 Edge Function invocations/month
- 400,000 database read & writes/month

### Netlify Free Tier
- 100GB bandwidth/month
- 300 build minutes/month

Both services should handle moderate traffic on free tiers.

## Security Best Practices

1. **API Rate Limiting**: Implement in Edge Functions
2. **Input Validation**: Sanitize slug parameters
3. **Error Handling**: Don't expose internal errors
4. **HTTPS Only**: Both services enforce HTTPS by default

## Support

- [Supabase Docs](https://supabase.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- GitHub Issues: Report problems in this repo