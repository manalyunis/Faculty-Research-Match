# GitHub Setup Guide for Faculty Research Match

Complete guide to push your project to GitHub and set up automated deployment.

## 🚀 Step-by-Step GitHub Setup

### Step 1: Create GitHub Repository

1. **Go to GitHub.com** and sign in
2. **Click "New repository"** (green button)
3. **Repository settings:**
   - Repository name: `faculty-research-match`
   - Description: `Faculty research similarity matching system with ML-powered clustering`
   - Visibility: Choose **Private** or **Public**
   - ❌ Don't initialize with README (you already have one)
   - ❌ Don't add .gitignore (you already have one)
   - ❌ Don't add license (add later if needed)

4. **Click "Create repository"**

### Step 2: Initialize Git and Push to GitHub

Open terminal in your project directory and run:

```bash
# Initialize git repository (if not already done)
git init

# Add all files to staging
git add .

# Create initial commit
git commit -m "Initial commit: Faculty Research Match with VPS deployment setup

- Complete Next.js application with ML similarity matching
- Python sentence-transformers integration
- Docker deployment configuration
- VPS deployment scripts for Ubuntu 24.04
- Nginx reverse proxy with SSL support
- Health monitoring and logging"

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/faculty-research-match.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Set Up Automated Deployment (Optional)

If you want GitHub to automatically deploy to your VPS when you push code:

#### 3.1 Generate SSH Key for GitHub Actions

On your **VPS**:
```bash
# Generate SSH key pair for GitHub Actions
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N ""

# Add the public key to authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Display private key (copy this for GitHub secrets)
cat ~/.ssh/github_actions
```

#### 3.2 Add GitHub Secrets

1. **Go to your GitHub repository**
2. **Click Settings** → **Secrets and variables** → **Actions**
3. **Add these secrets:**

   - **VPS_HOST**: Your VPS IP address (e.g., `123.456.789.10`)
   - **VPS_USERNAME**: `appuser`
   - **VPS_SSH_KEY**: The private key from `~/.ssh/github_actions` (entire content)

#### 3.3 Test Automated Deployment

1. **Make a small change** to any file
2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Test automated deployment"
   git push
   ```
3. **Check Actions tab** in GitHub to see deployment progress

## 📁 What Gets Pushed to GitHub

✅ **Included:**
- All source code (`src/`, `python/`, etc.)
- Deployment scripts (`deploy/`)
- Configuration files (`docker-compose.yml`, `Dockerfile`)
- Documentation (`README.md`, `GITHUB_SETUP.md`)
- Environment template (`.env.production.template`)

❌ **Excluded (via .gitignore):**
- `node_modules/`
- `.env.production` (contains secrets)
- `/logs/`, `/data/`
- Python cache and model files
- SSL certificates
- IDE and temporary files

## 🔒 Security Best Practices

### Environment Variables
- ✅ **Template included**: `.env.production.template`
- ❌ **Actual secrets excluded**: `.env.production`
- 📝 **VPS setup**: Copy template and fill in real values on VPS

### SSH Keys
- 🔑 **Dedicated key**: GitHub Actions uses separate SSH key
- 🛡️ **Limited access**: `appuser` account only
- 🔄 **Rotatable**: Can regenerate if compromised

### Repository Visibility
- 🔒 **Private**: Recommended for production projects
- 🌐 **Public**: OK if no sensitive data in code

## 🛠️ Development Workflow

### Making Changes
```bash
# Create feature branch
git checkout -b feature/new-similarity-algorithm

# Make your changes
# ... edit files ...

# Commit changes
git add .
git commit -m "Implement improved similarity algorithm"

# Push feature branch
git push origin feature/new-similarity-algorithm

# Create Pull Request on GitHub
# Merge to main when ready
```

### Deploying Changes
```bash
# Deploy to VPS (manual)
git checkout main
git pull origin main
git push

# Or use automated deployment (pushes to main trigger deployment)
```

## 📋 Repository Maintenance

### Keeping Dependencies Updated
```bash
# Update npm packages
npm update
git add package*.json
git commit -m "Update npm dependencies"
git push

# Update Python packages (update requirements.txt)
# Test on VPS, then commit
```

### Backup Strategy
```bash
# Tag important releases
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0

# Keep deployment backups on VPS
# (automatic via deployment script)
```

## 🚨 Troubleshooting

### Push Rejected
```bash
# If someone else made changes
git pull origin main
git push

# If you need to force push (careful!)
git push --force-with-lease
```

### Automated Deployment Fails
1. **Check GitHub Actions logs**
2. **Verify VPS secrets** in repository settings
3. **Test SSH connection** manually:
   ```bash
   ssh -i ~/.ssh/github_actions appuser@your-vps-ip
   ```

### Large Repository Size
```bash
# Check repository size
git count-objects -vH

# Clean up if needed
git gc --aggressive --prune=now
```

## 📞 Quick Reference

### Important Commands
```bash
# Check git status
git status

# View commit history
git log --oneline

# Create and switch to new branch
git checkout -b branch-name

# Push current branch
git push origin $(git branch --show-current)

# Pull latest changes
git pull origin main
```

### GitHub URLs
- **Repository**: `https://github.com/YOUR_USERNAME/faculty-research-match`
- **Actions**: `https://github.com/YOUR_USERNAME/faculty-research-match/actions`
- **Settings**: `https://github.com/YOUR_USERNAME/faculty-research-match/settings`

---

🎉 **Your Faculty Research Match project is now on GitHub and ready for collaborative development!**