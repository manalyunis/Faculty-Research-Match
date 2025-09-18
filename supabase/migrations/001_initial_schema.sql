-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create faculty table
CREATE TABLE IF NOT EXISTS faculty (
  faculty_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT NOT NULL,
  title TEXT NOT NULL,
  school TEXT NOT NULL,
  department TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimensions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS idx_faculty_name ON faculty USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_faculty_keywords ON faculty USING gin(to_tsvector('english', keywords));
CREATE INDEX IF NOT EXISTS idx_faculty_school ON faculty (school);
CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty (department);
CREATE INDEX IF NOT EXISTS idx_faculty_embedding ON faculty USING hnsw (embedding vector_cosine_ops);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_faculty_updated_at
    BEFORE UPDATE ON faculty
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for similarity search
CREATE OR REPLACE FUNCTION search_similar_faculty(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10,
  filter_school text DEFAULT NULL,
  filter_department text DEFAULT NULL
)
RETURNS TABLE (
  faculty_id text,
  name text,
  keywords text,
  title text,
  school text,
  department text,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    f.faculty_id,
    f.name,
    f.keywords,
    f.title,
    f.school,
    f.department,
    1 - (f.embedding <=> query_embedding) AS similarity
  FROM faculty f
  WHERE
    f.embedding IS NOT NULL
    AND 1 - (f.embedding <=> query_embedding) > match_threshold
    AND (filter_school IS NULL OR f.school = filter_school)
    AND (filter_department IS NULL OR f.department = filter_department)
  ORDER BY f.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Create RLS policies (Row Level Security)
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;

-- Allow public read access (adjust based on your security requirements)
CREATE POLICY "Public read access" ON faculty FOR SELECT USING (true);

-- Allow authenticated users to insert/update (for admin functionality)
CREATE POLICY "Authenticated users can insert" ON faculty FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update" ON faculty FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete" ON faculty FOR DELETE
TO authenticated USING (true);