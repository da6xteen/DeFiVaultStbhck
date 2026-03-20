#!/bin/bash
# StableHacks Vault — Judge Demo Script
BASE_URL=${1:-http://localhost:3001}
echo "=== StableHacks Vault Judge Demo ==="
echo "API: $BASE_URL"
echo ""

echo "--- Step 1: Health Check ---"
curl -s $BASE_URL/health | python3 -m json.tool

echo ""
echo "--- Step 2: Register wallet + get nonce ---"
WALLET="DemoWa11et$(date +%s)"
NONCE_RESP=$(curl -s -X POST $BASE_URL/api/auth/nonce \
  -H "Content-Type: application/json" \
  -d "{\"walletAddress\": \"$WALLET\"}")
echo $NONCE_RESP | python3 -m json.tool

echo ""
echo "--- Step 3: Attempt deposit WITHOUT KYC (should fail 403) ---"
curl -s -X POST $BASE_URL/api/vault/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer FAKE_TOKEN" \
  -d '{"amountUsdc": 500}' | python3 -m json.tool

echo ""
echo "--- Step 4: Vault public stats ---"
# Using /api/public/vault/stats to ensure it works with current backend implementation
curl -s $BASE_URL/api/public/vault/stats | python3 -m json.tool

echo ""
echo "=== Demo complete. Run npm test for full compliance verification. ==="
