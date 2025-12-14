# Render.com Deployment Guide (PostgreSQL Edition)
## Faculty Research Match - 100% Free Tier Deployment

Complete guide for deploying with **Render PostgreSQL** (no Supabase required).

---

## 🎯 What You're Deploying

- **Web Service**: Next.js app with Transformers.js ML
- **Database**: Render PostgreSQL (free tier, includes pgvector!)
- **Storage**: 1GB persistent disk for ML model cache
- **Cost**: $0/month (100% free tier)

---

## 📋 Prerequisites

1. **GitHub Account** with your code
2. **Render.com Account** ([sign up free](https://render.com))
3. Your faculty data (CSV/Excel file ready to import)

---

## 🚀 Step-by-Step Deployment

### Step 1: Push Code to GitHub

```bash
git add .
git commit -m "Migrate to PostgreSQL + Transformers.js for Render deployment"
git push origin main
```

### Step 2: Create Render Account

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Sign up with GitHub (recommended for easy deployment)
3. Authorize Render to access your repositories

###Step 3: Create PostgreSQL Database

1. Click "New +" → "PostgreSQL"
2. Configure:
   - **Name**: `faculty-research-db`
   - **Database**: `faculty_research`
   - **User**: `faculty_admin`
   - **Region**: Oregon (or closest to you)
   - **PostgreSQL Version**: 16 (latest)
   - **Plan**: Free
3. Click "Create Database"
4. Wait ~1-2 minutes for provisioning

**Important:** Render's free PostgreSQL includes **pgvector extension** built-in! ✓

### Step 4: Set Up Database Schema

After database is created:

1. In Render dashboard, click your database
2. Go to "Connect" tab
3. Copy the "PSQL Command" (looks like: `PGPASSWORD=xxx psql -h xxx`)
4. Open your terminal and run the command to connect
5. Once connected, run the schema setup:

```sql
\i database/schema.sql
```

OR copy/paste the contents of `database/schema.sql` into the SQL editor.

6. Verify setup:
```sql
-- Check pgvector is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check table exists
\d faculty

-- Should show 0 rows initially
SELECT COUNT(*) FROM faculty;
```

7. Type `\q` to exit

### Step 5: Create Web Service

1. Click "New +" → "Blueprint"
2. Connect your GitHub repository
3. Select `faculty-research-match`
4. Render will detect `render.yaml` and show:
   - ✓ PostgreSQL database: `faculty-research-db`
   - ✓ Web service: `faculty-research-match`
5. Click "Apply"

**Note:** If using Blueprint doesn't work, create manually:
1. Click "New +" → "Web Service"
2. Connect repository
3. Configure:
   - **Name**: `faculty-research-match`
   - **Runtime**: Docker
   - **Instance Type**: Free
   - **Dockerfile Path**: `./Dockerfile`

### Step 6: Link Database to Web Service

If created manually (skip if using Blueprint):

1. In your web service settings
2. Go to "Environment" tab
3. Add environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Click "Add from Database" → Select `faculty-research-db` → `Connection String`

### Step 7: Configure Environment Variables

In web service "Environment" tab, verify these are set:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=(linked from database)
TRANSFORMERS_CACHE=/app/.cache
ENABLE_ADVANCED_SIMILARITY=true
NEXT_PUBLIC_APP_URL=https://your-app.onrender.com
```

### Step 8: Add Persistent Disk (if not auto-created)

1. Scroll to "Disks" section
2. Click "Add Disk"
3. Configure:
   - **Name**: `transformers-models`
   - **Mount Path**: `/app/.cache`
   - **Size**: 1 GB
4. Save

### Step 9: Deploy!

1. Click "Create Web Service" (or "Manual Deploy")
2. Watch build logs (~3-5 minutes first time)
3. Wait for "Live" status

---

## 📊 Post-Deployment Setup

### Step 1: Import Faculty Data

**Option A: Via API** (Recommended)

Your app should have an `/api/ingest` endpoint:

```bash
curl -X POST https://your-app.onrender.com/api/ingest \
  -H "Content-Type: application/json" \
  -d @faculty-data.json
```

**Option B: Via Database** (Bulk import)

Connect to your Render PostgreSQL:

```sql
-- Example insert
INSERT INTO faculty (faculty_id, name, keywords, title, school, department)
VALUES
  ('12345', 'Dr. Jane Smith', 'machine learning, AI', 'Professor', 'Engineering', 'CS'),
  ('12346', 'Dr. John Doe', 'data science, statistics', 'Associate Professor', 'Engineering', 'CS');
```

Or use `\copy` for CSV import:
```sql
\copy faculty(faculty_id,name,keywords,title,school,department) FROM 'faculty.csv' DELIMITER ',' CSV HEADER;
```

### Step 2: Generate Embeddings

After importing faculty data, generate embeddings:

**Create an endpoint or run via Render Shell:**

```bash
# Access your web service shell
render shell faculty-research-match

# Run embedding generation (if you have a script)
node scripts/generate-embeddings.js
```

**Or via API endpoint** (create one if needed):
```bash
curl -X POST https://your-app.onrender.com/api/generate-embeddings
```

This will:
- Load Transformers.js model (~25MB, cached to disk)
- Generate 384-dim embeddings for all faculty
- Store in database

**Expected time:** ~2-5 seconds per 100 faculty members

### Step 3: Verify Deployment

Test these endpoints:

```bash
# Health check
curl https://your-app.onrender.com/api/health

# Faculty count
curl https://your-app.onrender.com/api/faculty/count

# Search
curl "https://your-app.onrender.com/api/search?q=machine+learning"

# Single faculty with similar matches
curl https://your-app.onrender.com/api/faculty/12345
```

### Step 4: Update App URL

1. Go to web service settings
2. Edit `NEXT_PUBLIC_APP_URL` environment variable
3. Set to: `https://your-actual-app.onrender.com`
4. Save (triggers redeploy)

---

## 💰 Free Tier Limits

### PostgreSQL Free Tier
- **Duration**: 90 days
- **After 90 days**: Database auto-pauses (not deleted!)
- **Storage**: 1 GB
- **RAM**: Shared
- **Note**: Can reactivate or upgrade to paid ($7/mo) before expiry

### Web Service Free Tier
- **Memory**: 512MB
- **Hours**: 750/month (~31 days always-on)
- **Spin-down**: After 15 min inactivity
- **Disk**: 1GB persistent storage
- **Bandwidth**: 100GB/month

---

## 🔧 Database Management

### Access via Render Dashboard

1. Go to database → "Connect" tab
2. Use "External Connection String" for local tools (pgAdmin, DBeaver)
3. Use "Internal Connection String" for your app (already configured)

### Common SQL Queries

```sql
-- Check faculty count
SELECT get_faculty_count();

-- Check embeddings count
SELECT get_faculty_with_embeddings_count();

-- List schools
SELECT * FROM get_schools();

-- List departments
SELECT * FROM get_departments();

-- View sample faculty
SELECT faculty_id, name, school, department
FROM faculty
LIMIT 10;

-- Test similarity search
SELECT * FROM search_similar_faculty(
  (SELECT embedding FROM faculty WHERE faculty_id = '12345'),
  0.3,  -- threshold
  10    -- limit
);
```

### Backup Database

```bash
# Download backup
pg_dump $(render config get DATABASE_URL) > backup.sql

# Restore backup
psql $(render config get DATABASE_URL) < backup.sql
```

---

## 🐛 Troubleshooting

### Database Connection Issues

**Error: "relation 'faculty' does not exist"**
- Schema not set up
- Solution: Run `database/schema.sql` in database

**Error: "extension 'vector' does not exist"**
- Should not happen on Render (pgvector included)
- If it does: `CREATE EXTENSION vector;`

**Error: "connection timeout"**
- Database may be paused (free tier after 90 days)
- Solution: Reactivate in dashboard or upgrade

### Build/Deployment Issues

**Error: "Unable to connect to database"**
- Check DATABASE_URL is set
- Verify database is running (not paused)
- Check region matches

**Slow first request after deploy**
- Normal: Cold start + model loading
- ~30-60 seconds expected
- Subsequent requests are fast

### Performance Issues

**Searches are slow**
- Check embeddings exist: `SELECT COUNT(*) FROM faculty WHERE embedding IS NOT NULL`
- Verify HNSW index built: `\d faculty` (should show index)
- For large datasets, index building takes time

**Model keeps re-downloading**
- Check persistent disk is mounted at `/app/.cache`
- Verify disk size is sufficient (1GB)

---

## 📈 Monitoring

### Database Stats

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('faculty_research'));

-- Table size
SELECT pg_size_pretty(pg_total_relation_size('faculty'));

-- Index size
SELECT pg_size_pretty(pg_indexes_size('faculty'));
```

### Application Logs

View in Render dashboard:
- Web service → "Logs" tab
- Real-time streaming
- Search and filter

### Health Checks

Render automatically monitors `/api/health`. If it fails 3 times, service restarts.

---

## 🔄 Updating Your App

### Code Changes

```bash
git add .
git commit -m "Update: description"
git push origin main

# Render auto-deploys (if enabled)
```

### Database Schema Changes

1. Create migration SQL file
2. Connect to database
3. Run migration:
```sql
\i database/migrations/002_add_new_column.sql
```

### Rollback Deployment

In Render dashboard:
1. Go to web service
2. Click "Events" tab
3. Find previous successful deploy
4. Click "Rollback"

---

## 💡 Tips & Best Practices

### Keep Service Warm

Free tier spins down after 15 min. Options:
1. **UptimeRobot** (free): Ping every 5 min
2. **Cron job**: Scheduled pings
3. **Upgrade to paid** ($7/mo): Always-on

### Optimize Embeddings

```sql
-- Find faculty without embeddings
SELECT faculty_id, name FROM faculty WHERE embedding IS NULL;

-- Batch update embeddings (via API preferred)
```

### Monitor Database Usage

```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity;

-- Active queries
SELECT pid, state, query FROM pg_stat_activity WHERE state = 'active';
```

---

## 🎯 Next Steps After Deployment

1. ✅ Import all faculty data
2. ✅ Generate embeddings for all faculty
3. ✅ Test search functionality
4. ✅ Share app URL with team
5. ✅ Set up UptimeRobot monitoring
6. ⏭️ Before day 85, decide: upgrade DB or migrate data

---

## 📞 Getting Help

### Render Support
- Docs: https://render.com/docs
- Community: https://community.render.com
- Status: https://status.render.com

### PostgreSQL Resources
- pgvector: https://github.com/pgvector/pgvector
- PostgreSQL docs: https://www.postgresql.org/docs/

### Project Issues
- Check application logs in Render dashboard
- Test database connection directly
- Verify environment variables

---

## ✅ Deployment Checklist

- [ ] GitHub repository created and pushed
- [ ] Render account created
- [ ] PostgreSQL database created
- [ ] Database schema set up (`schema.sql`)
- [ ] Web service created and deployed
- [ ] DATABASE_URL environment variable linked
- [ ] Persistent disk configured for model cache
- [ ] First deployment successful
- [ ] Faculty data imported
- [ ] Embeddings generated
- [ ] All API endpoints tested
- [ ] NEXT_PUBLIC_APP_URL updated
- [ ] UptimeRobot configured (optional)
- [ ] Calendar reminder set for day 85 (DB expiry warning)

---

## 🎉 You're Live!

Your Faculty Research Match is now deployed on Render with PostgreSQL!

**App URL:** `https://your-app.onrender.com`

**Database:** Render PostgreSQL with pgvector

**Features:**
✅ Semantic faculty search (Transformers.js)
✅ Vector similarity search (pgvector)
✅ 100% free tier deployment
✅ Auto-scaling & auto-healing

**Note:** Remember the 90-day free PostgreSQL limit. Set a calendar reminder for day 85 to decide on upgrading ($7/mo) or migrating data!

---

**Questions?** Check the troubleshooting section or review the logs in Render dashboard.
