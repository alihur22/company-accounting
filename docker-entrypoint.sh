#!/bin/sh
set -e
# Fly sets RELEASE_COMMAND=1 when running migrations before deploy
if [ "$RELEASE_COMMAND" = "1" ]; then
  npx prisma migrate deploy
  npx prisma db seed || true
  exit 0
fi
# Run migrations at startup (Railway, Render, etc.)
echo "Running migrations..."
npx prisma migrate deploy || true
echo "Starting server..."
exec node server.js
