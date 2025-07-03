#!/bin/bash

echo "🚀 Deploying Radio Backend to GitHub..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
fi

# Add all files
echo "📦 Adding files to git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Fix build errors and configure for Render deployment

- Fixed TypeScript ES module imports
- Added proper Request/Response types to route handlers  
- Changed database from SQLite to PostgreSQL for production
- Added Prisma client generation to build process
- Added environment variable support for PORT and NODE_ENV
- Created render.yaml for Render deployment
- Added comprehensive README and deployment documentation
- Updated .gitignore for production deployment
- Ready for streemr.app deployment! 🎉"

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🔗 Adding GitHub remote..."
    echo "Please run: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo "Replace YOUR_USERNAME and YOUR_REPO with your actual GitHub details"
else
    echo "📤 Pushing to GitHub..."
    git push -u origin main
fi

echo "✅ Done! Your code is ready for Render deployment."