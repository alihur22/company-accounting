#!/bin/sh
set -e
npx prisma migrate deploy
npx prisma db seed || true
exec node server.js
