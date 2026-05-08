#!/bin/sh
set -e

# Check for required environment variables
if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "Error: OPENROUTER_API_KEY is not set."
  exit 1
fi

if [ -z "$BETTER_AUTH_SECRET" ]; then
  echo "Error: BETTER_AUTH_SECRET is not set."
  exit 1
fi

# Set default SQLITE_PATH if not provided
export SQLITE_PATH=${SQLITE_PATH:-studio.sqlite}

# Run database migration src/lib/db/migrate.ts
npx -y ts-node src/lib/db/migrate.ts

# Start the application
exec "$@"
