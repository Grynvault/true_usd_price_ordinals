-- Add cached image data columns to collections table
ALTER TABLE collections ADD COLUMN inscription_id TEXT;
ALTER TABLE collections ADD COLUMN logo_image_base64 TEXT;
ALTER TABLE collections ADD COLUMN logo_cached_at TIMESTAMP;

-- Index for faster image lookups
CREATE INDEX idx_collections_logo_cached ON collections(logo_cached_at) WHERE logo_image_base64 IS NOT NULL;
CREATE INDEX idx_collections_inscription_id ON collections(inscription_id);