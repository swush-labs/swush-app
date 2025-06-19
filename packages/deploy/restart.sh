#!/bin/bash

echo "🔄 Restarting Swush-Me application..."

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

# Kill processes running on ports 3000 and 3001
kill_process_on_port 3000
kill_process_on_port 3001

echo "⏳ Waiting 3 seconds for clean shutdown..."
sleep 3

echo "📋 Step 2: Starting application..."

# Start the application with environment variable and log output
nohup env NEXT_PUBLIC_API_HOST=139.84.213.65 pnpm dev > output.log 2>&1 &

echo "✅ Application restarted successfully!"
echo "📋 Logs are being written to output.log"
echo "🔍 You can monitor logs with: tail -f output.log" 