#!/bin/bash

echo "🚀 Starting Swush UI with custom environment..."

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

# Kill process running on port 4000
kill_process_on_port 4000

# Also kill any existing UI process by name as backup
PID=$(pgrep -f "next dev" | head -1)
if [ ! -z "$PID" ]; then
    echo "🛑 Stopping existing UI process (PID: $PID)"
    kill -9 $PID
fi

echo "⏳ Waiting 3 seconds for clean shutdown..."
sleep 3

echo "📋 Step 2: Starting UI with custom environment (detached)..."

# Start the UI with custom environment variables on port 4000 (fully detached)
setsid bash -c '
    exec nohup env \
        NEXT_PUBLIC_API_HOST=api.swush.me \
        NEXT_PUBLIC_USE_HTTPS=true \
        NEXT_PUBLIC_USE_CHOPSTICKS=true \
        TRUST_PROXY=true \
        PORT=4000 \
        pnpm dev:ui > ui-dev.log 2>&1 < /dev/null
' &

# Get the process PID
sleep 2
BG_PID=$(pgrep -f "next dev" | head -1)
echo "📋 UI started with PID: $BG_PID"

echo "⏳ Waiting for UI to start..."
sleep 3

# Check if the application started successfully
if pgrep -f "next dev" > /dev/null; then
    echo "✅ UI started successfully!"
    echo "🌐 UI available at: http://localhost:4000"
    echo "📋 UI PID: $BG_PID"
    echo "📋 To stop the UI: kill $BG_PID"
    echo "📋 Check logs with: tail -f ui-dev.log"
else
    echo "❌ Failed to start UI"
    echo "📋 Check logs: tail -n 20 ui-dev.log"
    exit 1
fi 