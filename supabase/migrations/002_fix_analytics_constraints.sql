-- Add unique constraint for collection_id in collection_analytics
-- This prevents duplicate analytics entries for the same collection
ALTER TABLE collection_analytics ADD CONSTRAINT unique_collection_analytics UNIQUE (collection_id);

-- Add index for better query performance on collection_analytics join queries
CREATE INDEX IF NOT EXISTS idx_collection_analytics_collection_id ON collection_analytics(collection_id);