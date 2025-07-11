#!/bin/bash

echo "🔄 Restarting Swush-Me DEV STAGING application (Nginx + Node.js)..."

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

# Kill processes running on staging ports 4000 and 4001 (HTTP only, nginx handles HTTPS)
kill_process_on_port 4000
kill_process_on_port 4001

echo "⏳ Waiting 3 seconds for clean shutdown..."
sleep 3

echo "📋 Step 2: Starting DEV STAGING application (HTTP behind nginx)..."

# Start the application with staging environment variables (fully detached)
setsid bash -c '
    exec nohup env \
        NEXT_PUBLIC_API_HOST=dev.swush.me \
        NEXT_PUBLIC_USE_HTTPS=true \
        TRUST_PROXY=true \
        LOG_LEVEL=debug \
        PORT=4001 \
        pnpm dev -- --port 4000 > staging-output.log 2>&1 < /dev/null
' &

# Get the actual pnpm process PID (more reliable)
sleep 2
BG_PID=$(pgrep -f "pnpm dev" | head -1)
echo "📋 DEV STAGING application started with PID: $BG_PID"

# Give the application time to start
echo "⏳ Waiting for application to start..."
sleep 5

# Check if the application started successfully
if pgrep -f "pnpm dev" > /dev/null; then
    echo "✅ DEV STAGING application restarted successfully!"
    echo "🌐 Backend HTTP: http://localhost:4001 (internal)"
    echo "🌐 Frontend HTTP: http://localhost:4000 (internal)"
    echo "🔒 Public HTTPS: https://dev.swush.me (via nginx)"
    echo "📋 Application PID: $BG_PID"
    echo "📋 To stop the app: kill $BG_PID"
    echo ""
    
    # Check nginx status
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx is running"
    else
        echo "⚠️  Nginx is not running - start it with: sudo systemctl start nginx"
    fi
    
    echo ""
    echo "📋 Showing logs (Press Ctrl+C to exit, app will keep running)..."
    echo "================================================"
    
    # Verify process is still running before showing logs
    if ! kill -0 $BG_PID 2>/dev/null; then
        echo "⚠️  Background process not found, searching for pnpm dev..."
        BG_PID=$(pgrep -f "pnpm dev" | head -1)
        if [ -z "$BG_PID" ]; then
            echo "❌ No pnpm dev process found!"
            exit 1
        fi
        echo "📋 Found process PID: $BG_PID"
    fi
    
    # Enhanced signal handling - ignore SIGTERM to prevent accidental termination
    cleanup_logs() {
        echo ""
        echo "================================================"
        # Double-check process is still running
        if kill -0 $BG_PID 2>/dev/null; then
            echo "✅ DEV STAGING app still running (PID: $BG_PID)"
        else
            echo "⚠️  DEV STAGING app process may have stopped"
        fi
        echo "📋 View logs again: tail -f dev-output.log"
        echo "📋 Stop app: kill $BG_PID"
        exit 0
    }
    
    # Trap signals but ensure they don't affect background process
    trap cleanup_logs INT TERM
    
    # Show logs (this will only exit when interrupted)
    tail -f dev-output.log

else
    echo "❌ Failed to start DEV STAGING application"
    echo "📋 Check logs: tail -n 20 dev-output.log"
    exit 1
fi 