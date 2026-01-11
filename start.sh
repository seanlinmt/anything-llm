#!/bin/bash

# Function to kill process on a port
kill_port() {
    local port=$1
    # Check if lsof uses -P (no port names) and -n (no host names) for speed and accuracy
    local pid=$(lsof -t -i:$port)
    if [ -n "$pid" ]; then
        echo "Killing process on port $port (PID: $pid)"
        kill -9 $pid
    else
        echo "Port $port is free."
    fi
}

# Check and kill ports
# User requested 3000, 30001, 8888. Including 3001 as it is the standard server port (30001 likely typo).
echo "Checking ports 3000, 3001, 8888 ..."
kill_port 3000
kill_port 3001
kill_port 8888

# Double check availability
echo "Verifying port availability..."
sleep 1
unavailable=0
for port in 3000 3001 8888; do
    if lsof -i:$port > /dev/null; then
        echo "Error: Port $port is still in use."
        unavailable=1
    fi
done

if [ $unavailable -eq 1 ]; then
    echo "Some ports are still in use. Aborting."
    exit 1
fi

echo "All ports available."
echo "Starting AnythingLLM dev environment and Nemo Server..."

# Run yarn dev:all and nemo server concurrently
# This keeps all logs in one terminal window
npx concurrently \
    --names "SERVER,FRONTEND,COLLECTOR,NEMO" \
    --prefix-colors "blue,green,yellow,magenta" \
    "yarn dev:server" \
    "yarn dev:frontend" \
    "yarn dev:collector" \
    "python3 /home/sean/projects/cartara/nemo_server/app.py"
