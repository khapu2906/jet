#!/bin/sh
set -e

echo "Starting Jet ..."

# Run database migrations
echo "Running database migrations..."
if ! pnpm run db:migrate; then
  echo "ERROR: Database migration failed"
  exit 1
fi

echo "Migrations completed successfully"

# Execute the main command
echo "Starting application..."
exec "$@"
