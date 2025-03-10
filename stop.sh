#!/bin/bash

# Function to find and kill process by port
kill_process_on_port() {
    PORT=$1
    PID=$(sudo netstat -tulpn | grep ":$PORT" | awk '{print $7}' | cut -d'/' -f1)

    if [ ! -z "$PID" ]; then
        echo "Stopping process on port $PORT (PID: $PID)"
        sudo kill -9 $PID
    else
        echo "No application running on port $PORT"
    fi
}

# Kill processes running on ports 3000 and 3001
kill_process_on_port 3000
kill_process_on_port 3001

echo "All done."
