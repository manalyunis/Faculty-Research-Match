-- Sample Data for Testing
-- Insert a few faculty members for development/testing

-- Note: embeddings will be NULL initially
-- Use the /api/generate-embeddings endpoint to populate them

INSERT INTO faculty (faculty_id, name, keywords, title, school, department) VALUES
('TEST001', 'Dr. Jane Smith', 'machine learning, artificial intelligence, neural networks, deep learning', 'Associate Professor', 'School of Engineering', 'Computer Science'),
('TEST002', 'Dr. John Doe', 'data science, statistics, predictive modeling, big data analytics', 'Professor', 'School of Engineering', 'Computer Science'),
('TEST003', 'Dr. Alice Johnson', 'natural language processing, computational linguistics, text mining', 'Assistant Professor', 'School of Arts and Sciences', 'Linguistics'),
('TEST004', 'Dr. Bob Williams', 'computer vision, image processing, pattern recognition', 'Associate Professor', 'School of Engineering', 'Computer Science'),
('TEST005', 'Dr. Carol Brown', 'robotics, autonomous systems, control theory, mechatronics', 'Professor', 'School of Engineering', 'Mechanical Engineering')
ON CONFLICT (faculty_id) DO NOTHING;

-- Print summary
DO $$
DECLARE
  faculty_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO faculty_count FROM faculty;
  RAISE NOTICE 'Total faculty in database: %', faculty_count;
END $$;
