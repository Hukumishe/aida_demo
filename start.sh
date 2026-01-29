#!/bin/sh
set -e

echo "Building application..."
npm run build

echo "Checking if dist/main.js exists..."
if [ ! -f "dist/main.js" ]; then
  echo "ERROR: dist/main.js not found after build!"
  echo "Contents of dist directory:"
  ls -la dist/ || echo "dist directory does not exist"
  exit 1
fi

echo "Starting application..."
node dist/main.js

