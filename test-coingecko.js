#!/usr/bin/env node

/**
 * Test CoinGecko API integration for BestInSlot USD tracker
 */

const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function testCoinGecko() {
  console.log('Testing CoinGecko API integration...');

  // Test with a recent date range (last 30 days)
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);

  const fromUnix = Math.floor(fromDate.getTime() / 1000);
  const toUnix = Math.floor(toDate.getTime() / 1000);

  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromUnix}&to=${toUnix}`;

  console.log(`Testing date range: ${fromDate.toDateString()} to ${toDate.toDateString()}`);
  console.log(`URL: ${url}`);

  try {
    const data = await httpsGet(url);

    if (data.error) {
      console.error('CoinGecko API Error:', data.error.error_message);
      return;
    }

    const prices = data.prices || [];
    console.log(`✓ Successfully fetched ${prices.length} price points`);

    if (prices.length > 0) {
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];

      const firstDate = new Date(firstPrice[0]).toDateString();
      const lastDate = new Date(lastPrice[0]).toDateString();

      console.log(`✓ Date range: ${firstDate} to ${lastDate}`);
      console.log(`✓ Price range: $${firstPrice[1].toFixed(2)} to $${lastPrice[1].toFixed(2)}`);
      console.log('✓ CoinGecko API integration working correctly!');
    }

  } catch (error) {
    console.error('❌ CoinGecko API test failed:', error.message);
  }
}

testCoinGecko();