#!/bin/bash

echo "🚀 EsportsPulse API Deployment Script"
echo "====================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the api directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Test the server locally
echo "🧪 Testing server locally..."
timeout 10s npm start &
SERVER_PID=$!

sleep 5

# Check if server is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Server is running locally"
    kill $SERVER_PID 2>/dev/null
else
    echo "❌ Server failed to start locally"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo ""
echo "📋 Next Steps for Render Deployment:"
echo "===================================="
echo "1. Create a new GitHub repository"
echo "2. Push this code to GitHub:"
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Initial commit'"
echo "   git remote add origin YOUR_GITHUB_REPO_URL"
echo "   git push -u origin main"
echo ""
echo "3. Go to Render.com and create a new Web Service"
echo "4. Connect your GitHub repository"
echo "5. Use these settings:"
echo "   - Build Command: npm install"
echo "   - Start Command: npm start"
echo "   - Environment: Node"
echo ""
echo "6. Add these Environment Variables:"
echo "   - NODE_ENV: production"
echo "   - PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: true"
echo "   - PUPPETEER_EXECUTABLE_PATH: /usr/bin/google-chrome"
echo ""
echo "7. Deploy and test your API at: https://your-app-name.onrender.com/"
echo ""
echo "🎉 Good luck with your deployment!" 