const https = require('https');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Extract slug from query parameters
  const { slug } = event.queryStringParameters || {};

  if (!slug) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Slug parameter required' })
    };
  }

  try {
    // Fetch data from BestInSlot API
    const bestInSlotUrl = `https://v2api.bestinslot.xyz/collection/chart?slug=${encodeURIComponent(slug)}`;

    const data = await new Promise((resolve, reject) => {
      https.get(bestInSlotUrl, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('BestInSlot API Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch data from BestInSlot API',
        message: error.message
      })
    };
  }
};