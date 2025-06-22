#!/bin/bash

echo "🔄 Restarting Swush-Me application (Nginx + Node.js)..."

# Function to find and kill process by port
kill_process_on_port() {
    PORT=$1
    PID=$(sudo netstat -tulpn | grep ":$PORT" | awk '{print $7}' | cut -d'/' -f1)

    if [ ! -z "$PID" ]; then
        echo "🛑 Stopping process on port $PORT (PID: $PID)"
        sudo kill -9 $PID
    else
        echo "ℹ️  No application running on port $PORT"
    fi
}

echo "📋 Step 1: Stopping existing processes..."

# Kill processes running on ports 3000 and 3001 (HTTP only, nginx handles HTTPS)
kill_process_on_port 3000
kill_process_on_port 3001

echo "⏳ Waiting 3 seconds for clean shutdown..."
sleep 3

echo "📋 Step 2: Starting application (HTTP behind nginx)..."

# Start the application with production environment variables
nohup env \
    NEXT_PUBLIC_API_HOST=api.swush.me \
    NEXT_PUBLIC_USE_HTTPS=true \
    TRUST_PROXY=true \
    pnpm dev > output.log 2>&1 &

# Give the application time to start
echo "⏳ Waiting for application to start..."
sleep 5

# Check if the application started successfully
if pgrep -f "pnpm dev" > /dev/null; then
    echo "✅ Application restarted successfully!"
    echo "🌐 Backend HTTP: http://localhost:3001 (internal)"
    echo "🌐 Frontend HTTP: http://localhost:3000 (internal)"
    echo "🔒 Public HTTPS: https://app.swush.me (via nginx)"
    echo "📋 Logs: tail -f output.log"
    
    # Check nginx status
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx is running"
    else
        echo "⚠️  Nginx is not running - start it with: sudo systemctl start nginx"
    fi
else
    echo "❌ Failed to start application"
    echo "📋 Check logs: tail -n 20 output.log"
    exit 1
fi 