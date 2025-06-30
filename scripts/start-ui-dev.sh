#!/bin/bash

echo "🚀 Starting Swush UI with custom environment..."

# Kill any existing UI process
PID=$(pgrep -f "next dev" | head -1)
if [ ! -z "$PID" ]; then
    echo "🛑 Stopping existing UI process (PID: $PID)"
    kill -9 $PID
    sleep 2
fi

echo "📋 Starting UI with custom environment (detached)..."

# Start the UI with custom environment variables (fully detached)
setsid bash -c '
    exec nohup env \
        NEXT_PUBLIC_API_HOST=dev.swush.me \
        NEXT_PUBLIC_USE_HTTPS=true \
        NEXT_PUBLIC_USE_CHOPSTICKS=true \
        TRUST_PROXY=true \
        cd apps/web && pnpm dev > ui-dev.log 2>&1 < /dev/null
' &

# Get the process PID
sleep 2
BG_PID=$(pgrep -f "next dev" | head -1)
echo "📋 UI started with PID: $BG_PID"

echo "⏳ Waiting for UI to start..."
sleep 3

echo "✅ UI should be running. Check logs with: tail -f ui-dev.log"
echo "🌐 UI will be available at: http://localhost:3000" 