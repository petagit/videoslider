#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Video Editor..."
# Check if build exists, if not run build
if [ ! -d ".next" ]; then
    echo "Build not found. Building app..."
    npm run build
fi
# Open the browser after a short delay to allow server to start
(sleep 3 && open http://localhost:3001) &
npm run start -- -p 3001

