# Render.com Deployment Guide
## Faculty Research Match - Free Tier Deployment

This guide walks you through deploying your Faculty Research Match application to Render.com's free tier using Transformers.js (no Python or Redis required).

---

## 🎯 Prerequisites

1. **GitHub Account** - Your code needs to be in a GitHub repository
2. **Render.com Account** - Sign up at [render.com](https://render.com) (free)
3. **Supabase Project** - Your existing Supabase database with faculty data

---

## 📋 What's Included

### ✅ Features Available (Free Tier)
- Semantic faculty similarity search (Transformers.js)
- Faculty profile viewing
- Keyword-based search
- Department/school filtering
- Network visualization (department-based clustering)
- In-memory caching

### ❌ Features Not Available
- Advanced clustering (HDBSCAN/UMAP - requires Python)
- Topic analysis (requires Python NLP libraries)
- Redis caching (in-memory caching used instead)

---

## 🚀 Step-by-Step Deployment

### Step 1: Push Code to GitHub

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit changes
git commit -m "Prepare for Render.com deployment with Transformers.js"

# Create GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/faculty-research-match.git
git branch -M main
git push -u origin main
```

### Step 2: Create Render Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select your `faculty-research-match` repository

### Step 3: Configure Build Settings

**Basic Settings:**
- **Name**: `faculty-research-match` (or your preferred name)
- **Region**: Choose closest to your users (e.g., Oregon, Ohio)
- **Branch**: `main`
- **Runtime**: `Docker`
- **Instance Type**: `Free`

**Advanced Settings:**
- **Dockerfile Path**: `./Dockerfile` (should auto-detect)
- **Docker Context**: `.` (root directory)
- **Auto-Deploy**: `Yes` (recommended)

### Step 4: Add Environment Variables

Click "Environment" and add these variables:

#### Required Variables:

```
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Supabase (REQUIRED - copy from your .env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Transformers.js
TRANSFORMERS_CACHE=/app/.cache
```

#### Optional Variables:

```
# OpenAI (only if using OpenAI features)
OPENAI_API_KEY=your_openai_key_here

# Feature flags
ENABLE_ADVANCED_SIMILARITY=true
ENABLE_CACHING=true
```

### Step 5: Configure Persistent Disk (Recommended)

This caches the ML model (~25MB) so it doesn't re-download on every deploy.

1. Scroll to "Disk" section
2. Click "Add Disk"
3. **Name**: `transformers-models`
4. **Mount Path**: `/app/.cache`
5. **Size**: `1 GB` (free tier allows up to 1GB)

### Step 6: Deploy!

1. Click "Create Web Service"
2. Wait for build to complete (~3-5 minutes first time)
3. Watch the logs for any errors

---

## 📊 Monitoring Deployment

### Build Logs
Watch the deployment logs in real-time:
- Shows Docker build progress
- Displays any errors
- Shows when server starts

### Health Check
Render automatically monitors: `https://your-app.onrender.com/api/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Cold Starts
⚠️ **Free tier services spin down after 15 minutes of inactivity**
- First request after spin-down takes ~30-60 seconds
- ML model loads on first request (~10-20 seconds)
- Subsequent requests are fast

---

## 🔧 Post-Deployment Configuration

### Step 1: Update Application URL

After deployment, update the `NEXT_PUBLIC_APP_URL` environment variable:

1. Go to your service → "Environment"
2. Edit `NEXT_PUBLIC_APP_URL`
3. Set to: `https://your-app-name.onrender.com`
4. Save changes (triggers redeploy)

### Step 2: Test Endpoints

Test these endpoints to verify deployment:

```bash
# Health check
curl https://your-app.onrender.com/api/health

# Search functionality
curl "https://your-app.onrender.com/api/search?q=machine+learning"

# Faculty profile
curl https://your-app.onrender.com/api/faculty/202203388
```

### Step 3: Generate Embeddings (If Needed)

If your database doesn't have embeddings yet, generate them:

**Option A: Via Local Script**
```bash
# Run locally with production database
npm run dev
# Then visit: http://localhost:3000/api/generate-embeddings
```

**Option B: Via Render Shell**
```bash
# Access Render shell
render shell your-service-name

# Run embedding generation
node -e "require('./src/lib/advanced-similarity').advancedSimilarityService.generateAndStoreEmbeddings().then(console.log)"
```

---

## 💡 Optimization Tips

### 1. Keep Service Warm
Free tier spins down after 15 min. To keep warm:
- Use a service like [UptimeRobot](https://uptimerobot.com) (free)
- Ping your `/api/health` endpoint every 5 minutes
- Note: This consumes your 750 free hours faster

### 2. Model Caching
- Always use the persistent disk for `/app/.cache`
- First load downloads model (~25MB)
- Subsequent loads use cached model

### 3. Performance
Expected performance on free tier:
- **Cold start**: 30-60 seconds
- **Warm request**: <1 second
- **Similarity search**: 200-500ms
- **Memory usage**: 200-400MB

### 4. Logging
View logs in Render dashboard:
```bash
# Or via CLI
render logs -f your-service-name
```

---

## 🐛 Troubleshooting

### Build Fails

**Error: "Cannot find module '@xenova/transformers'"**
```bash
# Solution: Run locally to verify package.json
npm install
npm run build
```

**Error: "Docker build failed"**
- Check Dockerfile syntax
- Verify all paths are correct
- Check logs for specific error

### Runtime Errors

**Error: "Supabase connection failed"**
- Verify environment variables are set
- Check Supabase URL and keys are correct
- Ensure Supabase project is not paused

**Error: "Model download failed"**
- Check internet connectivity
- Verify `/app/.cache` disk is mounted
- May need to retry (model download can timeout)

**Service keeps spinning down**
- Expected behavior on free tier
- Use UptimeRobot to ping every 5 min
- Or upgrade to paid tier ($7/month for always-on)

### Slow Performance

**First request slow after spin-down**
- Normal: Cold start + model loading
- ~30-60 seconds is expected
- Enable persistent disk to speed up model loading

**All requests slow**
- Check Supabase query performance
- Verify embeddings exist in database
- Monitor logs for errors

---

## 📈 Scaling Options

### Free Tier Limits
- **Memory**: 512MB
- **CPU**: Shared
- **Hours**: 750/month (~31 days always-on)
- **Disk**: 1GB persistent storage
- **Bandwidth**: 100GB/month

### When to Upgrade
Upgrade to paid tier ($7/month) if:
- Need always-on (no spin-down)
- Handle more than 10-20 concurrent users
- Need faster response times
- Want more memory (1GB, 2GB, 4GB)

### Upgrading
1. Go to service settings
2. Change Instance Type from "Free" to "Starter" ($7/mo)
3. Benefits:
   - Always-on (no cold starts)
   - 512MB RAM (can upgrade to 2GB)
   - Priority support

---

## 🔐 Security Best Practices

### Environment Variables
- Never commit `.env` files to git
- Use Render's environment variable manager
- Rotate Supabase keys periodically

### CORS
Update allowed origins in production:
```env
ALLOWED_ORIGINS=https://your-app.onrender.com
```

### Monitoring
- Enable Render's health checks
- Set up UptimeRobot for external monitoring
- Check logs regularly

---

## 📚 Additional Resources

### Render Documentation
- [Render Docker Deployments](https://render.com/docs/docker)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Persistent Disks](https://render.com/docs/disks)

### Transformers.js
- [Documentation](https://huggingface.co/docs/transformers.js)
- [Models](https://huggingface.co/Xenova)

### Support
- Render Community: [community.render.com](https://community.render.com)
- Render Status: [status.render.com](https://status.render.com)

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Render service created and connected
- [ ] All environment variables set
- [ ] Persistent disk configured for model cache
- [ ] First deployment successful
- [ ] Health check endpoint working
- [ ] Search API tested
- [ ] Faculty API tested
- [ ] Embeddings generated (if needed)
- [ ] NEXT_PUBLIC_APP_URL updated
- [ ] Optional: UptimeRobot configured

---

## 🎉 You're Live!

Your Faculty Research Match application is now deployed on Render.com!

**Access your app:**
```
https://your-app-name.onrender.com
```

**API Endpoints:**
- Health: `/api/health`
- Search: `/api/search?q=query`
- Faculty: `/api/faculty/[id]`
- Network: `/api/network`

**Note:** First load may take 30-60 seconds (cold start + model loading). Subsequent requests will be fast!

---

## 🔄 Updating Your Deployment

To deploy updates:

```bash
# Make changes to your code
git add .
git commit -m "Update: description of changes"
git push origin main

# Render auto-deploys (if enabled)
# Or trigger manual deploy in Render dashboard
```

---

**Need Help?** Check the troubleshooting section or open an issue on GitHub.
