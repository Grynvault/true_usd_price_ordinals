-- Bitcoin price caching table
CREATE TABLE bitcoin_prices (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    source VARCHAR(50) DEFAULT 'coingecko',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Collections data caching table
CREATE TABLE collections (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200),
    description TEXT,
    logo_url TEXT,
    first_inscription_date DATE,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Collection price data caching table
CREATE TABLE collection_prices (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    btc_price DECIMAL(10, 8) NOT NULL,
    usd_price DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(collection_id, date)
);

-- Collection analytics and trend data
CREATE TABLE collection_analytics (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
    total_points INTEGER NOT NULL,
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    min_usd DECIMAL(12, 2),
    max_usd DECIMAL(12, 2),
    avg_usd DECIMAL(12, 2),
    trend_gradient DECIMAL(10, 6), -- Slope of trend line
    stability_score DECIMAL(5, 4), -- 0-1 score for stability
    upward_trend BOOLEAN DEFAULT FALSE,
    last_calculated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bitcoin_prices_date ON bitcoin_prices(date);
CREATE INDEX idx_collections_slug ON collections(slug);
CREATE INDEX idx_collection_prices_collection_date ON collection_prices(collection_id, date);
CREATE INDEX idx_collection_analytics_gradient ON collection_analytics(trend_gradient DESC);
CREATE INDEX idx_collection_analytics_stability ON collection_analytics(stability_score DESC, upward_trend);
CREATE INDEX idx_collections_first_inscription ON collections(first_inscription_date);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();