#!/bin/bash

# NexusSyncPro - Update Script
# Run this after 'git pull' to update the application

set -e

echo "🔄 NexusSyncPro - Updating Application"
echo "======================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Detect project directory
if [ -f "package.json" ]; then
    PROJECT_DIR="$(pwd)"
elif [ -f "/root/NexusSyncPro/package.json" ]; then
    PROJECT_DIR="/root/NexusSyncPro"
elif [ -f "$HOME/NexusSyncPro/package.json" ]; then
    PROJECT_DIR="$HOME/NexusSyncPro"
else
    echo -e "${RED}Error: Could not find project directory${NC}"
    echo -e "${YELLOW}Please run this script from the NexusSyncPro directory${NC}"
    exit 1
fi

WEB_DIR="/var/www/nexussync"

cd "$PROJECT_DIR"

echo -e "${GREEN}Project: $PROJECT_DIR${NC}"
echo -e "${GREEN}Web Dir: $WEB_DIR${NC}\n"

# Step 1: Install frontend dependencies
echo -e "${YELLOW}[1/5] Installing frontend dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# Step 2: Build frontend
echo -e "${YELLOW}[2/5] Building frontend...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}✗ Build failed! dist/ directory not found.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Step 3: Install backend dependencies
echo -e "${YELLOW}[3/5] Installing backend dependencies...${NC}"
cd server
npm install
cd ..
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Step 4: Deploy to web directory
echo -e "${YELLOW}[4/5] Deploying to web directory...${NC}"
sudo rm -rf "$WEB_DIR"/*
sudo cp -r dist/* "$WEB_DIR"/
sudo chown -R www-data:www-data "$WEB_DIR"
sudo chmod -R 755 "$WEB_DIR"
echo -e "${GREEN}✓ Files deployed${NC}"

# Step 5: Restart services
echo -e "${YELLOW}[5/5] Restarting services...${NC}"

# Clear Nginx cache
sudo rm -rf /var/cache/nginx/* 2>/dev/null || true

# Restart backend
pm2 restart nexus-sync-pro-server || pm2 restart all
echo -e "${GREEN}✓ Backend restarted${NC}"

# Reload Nginx
if sudo systemctl reload nginx; then
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
else
    echo -e "${RED}✗ Nginx reload failed!${NC}"
    exit 1
fi

# Verification
echo -e "\n${YELLOW}Verifying deployment...${NC}"
if [ -f "$WEB_DIR/index.html" ]; then
    FILE_TIME=$(stat -c %y "$WEB_DIR/index.html" 2>/dev/null || stat -f %Sm "$WEB_DIR/index.html" 2>/dev/null || echo "unknown")
    FILE_SIZE=$(ls -lh "$WEB_DIR/index.html" | awk '{print $5}')
    echo -e "${GREEN}✓ index.html deployed${NC}"
    echo -e "  Size: $FILE_SIZE"
    echo -e "  Modified: $FILE_TIME"
    
    JS_COUNT=$(find "$WEB_DIR/assets" -name "*.js" 2>/dev/null | wc -l)
    CSS_COUNT=$(find "$WEB_DIR/assets" -name "*.css" 2>/dev/null | wc -l)
    echo -e "  JS files: $JS_COUNT"
    echo -e "  CSS files: $CSS_COUNT"
else
    echo -e "${RED}✗ index.html not found!${NC}"
    exit 1
fi

echo -e "\n${GREEN}======================================"
echo -e "✅ Update Complete!"
echo -e "======================================${NC}\n"

pm2 status

echo -e "\n${YELLOW}⚠️  IMPORTANT: Clear browser cache!${NC}"
echo -e "   - Hard refresh: ${GREEN}Ctrl+Shift+R${NC} (Windows) or ${GREEN}Cmd+Shift+R${NC} (Mac)"
echo -e "   - Or open in incognito/private window"
echo ""

