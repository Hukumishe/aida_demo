#!/bin/sh
set -e

echo "Current directory:"
pwd

echo "Running database migrations..."
npx prisma migrate deploy
echo "Migrations done."

echo "Listing files before build:"
ls -la

echo "Building application..."
npm run build

echo "Build exit code: $?"

echo "Checking if dist/main.js exists..."
if [ ! -f "dist/main.js" ]; then
  echo "ERROR: dist/main.js not found after build!"
  echo "Contents of dist directory:"
  ls -la dist/ || echo "dist directory does not exist"
  echo "Looking for any .js files in dist:"
  find dist -name "*.js" -type f 2>/dev/null || echo "No .js files found"
  echo "Looking for main files:"
  find dist -name "main*" 2>/dev/null || echo "No main files found"
  exit 1
fi

echo "Starting application..."
node dist/main.js

