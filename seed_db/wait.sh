#!/bin/sh

set -e

echo "⏳ Waiting for Postgres..."

MAX_RETRIES=20
RETRY_COUNT=0

until pg_isready -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME"; do
  RETRY_COUNT=$((RETRY_COUNT+1))

  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Postgres not ready after $MAX_RETRIES attempts"
    exit 1
  fi

  echo "⏳ Retry $RETRY_COUNT/$MAX_RETRIES..."
  sleep 2
done

echo "✅ Postgres is ready!"

echo "🚀 Running Seeder..."
npm run seed

echo "🎉 Seeding completed!"