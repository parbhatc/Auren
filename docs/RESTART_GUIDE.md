# Server Restart Guide

This guide explains how to restart the backend and frontend after pulling updates from git.

## Quick Restart Commands

### After Git Pull - Full Restart

```bash
cd /root/NexusSyncPro

# 1. Pull latest changes
git pull

# 2. Install/update dependencies (if package.json changed)
npm install
cd server && npm install && cd ..

# 3. Rebuild frontend (if frontend code changed)
npm run build

# 4. Copy frontend files to web directory (if using Nginx)
sudo cp -r dist/* /var/www/nexussyncpro/

# 5. Restart backend
pm2 restart nexussyncpro-backend

# 6. Restart frontend (if using PM2, otherwise Nginx auto-serves new files)
# If using Nginx, no restart needed - files are already copied
# If using PM2 for frontend:
pm2 restart nexussyncpro-frontend
```

## Restart Backend Only

### Using PM2 (Recommended)

```bash
# Restart backend
pm2 restart nexussyncpro-backend

# Or restart all PM2 processes
pm2 restart all

# View logs
pm2 logs nexussyncpro-backend

# Check status
pm2 status
```

### Manual Restart (if not using PM2)

```bash
# Stop the server (Ctrl+C if running in terminal)
# Then start again:
cd /root/NexusSyncPro/server
npm start
```

## Restart Frontend Only

### If Using Nginx (Serving Static Files)

**If Nginx root is `/root/NexusSyncPro/dist`:**

```bash
cd /root/NexusSyncPro

# Rebuild frontend
npm run build

# Ensure Nginx can read files
sudo chmod -R 755 /root/NexusSyncPro/dist
sudo chmod 755 /root
sudo chmod 755 /root/NexusSyncPro

# Reload Nginx
sudo systemctl reload nginx
```

**If Nginx root is `/var/www/nexussyncpro`:**

```bash
cd /root/NexusSyncPro

# Rebuild frontend
npm run build

# Copy to web directory
sudo cp -r dist/* /var/www/nexussyncpro/
sudo chown -R www-data:www-data /var/www/nexussyncpro
sudo chmod -R 755 /var/www/nexussyncpro

# Reload Nginx
sudo systemctl reload nginx
```

**Check which directory Nginx is using:**
```bash
sudo cat /etc/nginx/sites-available/nexussyncpro | grep root
```

### If Using PM2 (Vite Preview)

```bash
# Restart frontend process
pm2 restart nexussyncpro-frontend

# Or rebuild and restart
cd /root/NexusSyncPro
npm run build
pm2 restart nexussyncpro-frontend
```

## Common Update Scenarios

### Scenario 1: Backend Code Changes Only

```bash
cd /root/NexusSyncPro
git pull
cd server && npm install && cd ..  # Only if dependencies changed
pm2 restart nexussyncpro-backend
```

### Scenario 2: Frontend Code Changes Only

```bash
cd /root/NexusSyncPro
git pull
npm install  # Only if dependencies changed
npm run build
sudo cp -r dist/* /var/www/nexussyncpro/
# Nginx automatically serves new files, or:
sudo systemctl reload nginx
```

### Scenario 3: Both Backend and Frontend Changed

```bash
cd /root/NexusSyncPro
git pull
npm install
cd server && npm install && cd ..
npm run build
sudo cp -r dist/* /var/www/nexussyncpro/
pm2 restart nexussyncpro-backend
sudo systemctl reload nginx
```

### Scenario 4: Database Schema Changes

```bash
cd /root/NexusSyncPro
git pull
cd server && npm install && cd ..
# Database migrations run automatically on server start
pm2 restart nexussyncpro-backend
```

## Handling Git Conflicts

### If You Have Local Changes

**Option 1: Stash and Reapply (Recommended)**

```bash
cd /root/NexusSyncPro

# Stash your local changes
git stash

# Pull latest changes
git pull

# Reapply your stashed changes
git stash pop

# If conflicts occur, resolve them manually, then:
npm install  # Update dependencies if needed
npm run build  # Rebuild frontend
sudo cp -r dist/* /var/www/nexussyncpro/
pm2 restart nexussyncpro-backend
```

**Option 2: Commit Your Changes First**

```bash
cd /root/NexusSyncPro

# Add and commit your changes
git add .
git commit -m "Local fixes and updates"

# Pull with rebase
git pull --rebase

# If conflicts, resolve them, then:
git add .
git rebase --continue

# Restart services
npm install  # If dependencies changed
npm run build
sudo cp -r dist/* /var/www/nexussyncpro/
pm2 restart nexussyncpro-backend
```

**Option 3: Discard Local Changes (Use Remote Version)**

```bash
cd /root/NexusSyncPro

# Discard local changes
git checkout -- .

# Pull latest
git pull

# Restart services
npm install
cd server && npm install && cd ..
npm run build
sudo cp -r dist/* /var/www/nexussyncpro/
pm2 restart nexussyncpro-backend
```

## Verification After Restart

### Check Backend Status

```bash
# Check PM2 status
pm2 status

# Check backend logs
pm2 logs nexussyncpro-backend --lines 50

# Test backend API
curl http://localhost:3001/api/health
```

### Check Frontend Status

```bash
# If using Nginx
sudo systemctl status nginx

# If using PM2
pm2 status nexussyncpro-frontend
pm2 logs nexussyncpro-frontend --lines 50

# Test frontend
curl http://localhost:3000
```

### Check Application in Browser

- Frontend: `http://your-vps-ip:3000`
- Backend Health: `http://your-vps-ip:3001/api/health`

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
pm2 logs nexussyncpro-backend

# Check if port is in use
sudo netstat -tulpn | grep :3001

# Check .env file exists
ls -la /root/NexusSyncPro/server/.env

# Try manual start to see errors
cd /root/NexusSyncPro/server
npm start
```

### Frontend Not Updating

```bash
# Verify build completed
ls -la /root/NexusSyncPro/dist/index.html

# Check your Nginx root directory configuration
sudo cat /etc/nginx/sites-available/nexussyncpro | grep root

# If Nginx root is /root/NexusSyncPro/dist:
sudo chmod -R 755 /root/NexusSyncPro/dist
sudo chmod 755 /root
sudo chmod 755 /root/NexusSyncPro
sudo systemctl reload nginx

# If Nginx root is /var/www/nexussyncpro:
sudo mkdir -p /var/www/nexussyncpro
sudo cp -r /root/NexusSyncPro/dist/* /var/www/nexussyncpro/
sudo chown -R www-data:www-data /var/www/nexussyncpro
sudo chmod -R 755 /var/www/nexussyncpro
sudo systemctl reload nginx

# Verify files exist
ls -la /var/www/nexussyncpro/index.html  # If using /var/www
# OR
ls -la /root/NexusSyncPro/dist/index.html  # If using /root

# Test Nginx can read files
sudo -u www-data ls -la /root/NexusSyncPro/dist/index.html  # If using /root

# Clear browser cache (Ctrl+Shift+R or Ctrl+F5)
# Or hard refresh: Right-click refresh button → "Empty Cache and Hard Reload"
```

### Nginx Configuration and Directory Setup

**Important:** Your Nginx config uses `/root/NexusSyncPro/dist` as the root directory. This means:
- After `npm run build`, files are automatically in the right place
- No need to copy files to `/var/www/nexussyncpro`
- But you must ensure Nginx can read files in `/root` directory

**Check which directory your Nginx is using:**
```bash
sudo cat /etc/nginx/sites-available/nexussyncpro | grep root
```

**If using `/root/NexusSyncPro/dist` (your current setup):**
```bash
# After each build, ensure permissions:
sudo chmod 755 /root
sudo chmod 755 /root/NexusSyncPro
sudo chmod -R 755 /root/NexusSyncPro/dist
sudo systemctl reload nginx
```

**If you want to switch to `/var/www/nexussyncpro`:**
1. Update Nginx config: Change `root /root/NexusSyncPro/dist;` to `root /var/www/nexussyncpro;`
2. After each build: `sudo cp -r dist/* /var/www/nexussyncpro/`

Your Nginx config should look like this (`/etc/nginx/sites-available/nexussyncpro`):

```nginx
server {
    listen 3000;
    server_name _;

    root /root/NexusSyncPro/dist;  # Or /var/www/nexussyncpro
    index index.html;

    # Frontend - serve static files
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # API proxy to backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for backend
    location /backtester-ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /backtester/data-management-ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /tradesea-mds-ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /tradesea-trades-ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Important Notes:**
- If using `/root/NexusSyncPro/dist` as root, ensure permissions: `sudo chmod 755 /root && sudo chmod -R 755 /root/NexusSyncPro/dist`
- If using `/var/www/nexussyncpro`, copy files after each build: `sudo cp -r dist/* /var/www/nexussyncpro/`
- After changing Nginx config: `sudo nginx -t && sudo systemctl reload nginx`

### PM2 Process Not Found

```bash
# List all PM2 processes
pm2 list

# If process doesn't exist, start it
cd /root/NexusSyncPro
pm2 start server/server.js --name nexussyncpro-backend
pm2 save
```

## Quick Reference

| Action | Command |
|--------|---------|
| Restart backend | `pm2 restart nexussyncpro-backend` |
| Restart frontend (PM2) | `pm2 restart nexussyncpro-frontend` |
| Restart all PM2 | `pm2 restart all` |
| View backend logs | `pm2 logs nexussyncpro-backend` |
| View frontend logs | `pm2 logs nexussyncpro-frontend` |
| Rebuild frontend | `npm run build` |
| Copy frontend files | `sudo cp -r dist/* /var/www/nexussyncpro/` |
| Reload Nginx | `sudo systemctl reload nginx` |
| Check PM2 status | `pm2 status` |
| Test backend | `curl http://localhost:3001/api/health` |

## Automated Update Script

Create a script to automate updates:

```bash
cd /root/NexusSyncPro
cat > update.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Updating NexusSyncPro..."

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd server && npm install && cd ..

# Rebuild frontend
echo "🏗️  Building frontend..."
npm run build

# Copy frontend files
echo "📋 Copying frontend files..."
sudo cp -r dist/* /var/www/nexussyncpro/

# Restart backend
echo "🔄 Restarting backend..."
pm2 restart nexussyncpro-backend

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Update complete!"
echo "Backend: http://$(hostname -I | awk '{print $1}'):3001/api/health"
echo "Frontend: http://$(hostname -I | awk '{print $1}'):3000"
EOF

chmod +x update.sh
```

Then run updates with:
```bash
./update.sh
```

