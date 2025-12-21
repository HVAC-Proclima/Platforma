#!/bin/sh
set -e

echo "Running migrations..."
/app/migrate

echo "Starting API..."
exec /app/server
