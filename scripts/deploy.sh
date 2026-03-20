#!/bin/bash
# One-command setup for judges/evaluators
set -e
echo "=== StableHacks Vault — Setup ==="
echo "1. Starting local services..."
docker-compose up -d
sleep 3
echo "2. Installing backend dependencies..."
cd backend && npm ci
echo "3. Running database migrations..."
npx prisma migrate deploy
npx prisma generate
echo "4. Seeding database..."
npx ts-node src/lib/seed.ts
echo "5. Installing frontend dependencies..."
cd ../frontend && npm ci
echo "=== Setup complete ==="
echo "Run: cd backend && npm run dev"
echo "Run: cd frontend && npm run dev"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
