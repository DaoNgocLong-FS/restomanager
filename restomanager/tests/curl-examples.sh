#!/usr/bin/env bash
# RestoManager – test API bằng cURL
# Yêu cầu: jq (sudo apt install jq | brew install jq)
set -e
API=${API:-http://localhost:3000/api}

echo "── Health ──────────────────────────────────────"
curl -s "$API/health" | jq .

echo
echo "── Login admin ─────────────────────────────────"
LOGIN_RES=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123"}')
echo "$LOGIN_RES" | jq '.data | {token: .token[0:30] + "...", refresh_token: .refresh_token[0:30] + "...", user: .user.username}'

TOKEN=$(echo "$LOGIN_RES"   | jq -r '.data.token')
REFRESH=$(echo "$LOGIN_RES" | jq -r '.data.refresh_token')
AUTH="Authorization: Bearer $TOKEN"

echo
echo "── /auth/me ────────────────────────────────────"
curl -s "$API/auth/me" -H "$AUTH" | jq '.data'

echo
echo "── List tables (with_status) ───────────────────"
curl -s "$API/tables?with_status=true" -H "$AUTH" | jq '.data | length'

echo
echo "── List menu ───────────────────────────────────"
curl -s "$API/menu?active=true" -H "$AUTH" | jq '.data | length'

echo
echo "── Refresh token ───────────────────────────────"
curl -s -X POST "$API/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}" | jq '.data | {token: .token[0:30] + "...", expires_in}'

echo
echo "── Tạo đơn (waiter login + createOrder) ────────"
W_LOGIN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"username":"waiter","password":"123"}')
W_TOKEN=$(echo "$W_LOGIN" | jq -r '.data.token')

ORDER_RES=$(curl -s -X POST "$API/orders" \
  -H "Authorization: Bearer $W_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_code":"T1-01",
    "waiter_name":"NV Test",
    "items":[
      {"item_name":"Phở Bò Kobe","quantity":2,"price":250000},
      {"item_name":"Trà Đá","quantity":4,"price":5000}
    ]
  }')
echo "$ORDER_RES" | jq '.data | {id, code, table_code, status, total_amount}'
ORDER_ID=$(echo "$ORDER_RES" | jq -r '.data.id')

echo
echo "── Checkout (cashier) ──────────────────────────"
C_LOGIN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"username":"cashier","password":"123"}')
C_TOKEN=$(echo "$C_LOGIN" | jq -r '.data.token')

curl -s -X POST "$API/orders/$ORDER_ID/checkout" \
  -H "Authorization: Bearer $C_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cashier_name":"Cashier Test",
    "payment_method":"cash",
    "vat_rate":8,
    "paid_amount":600000
  }' | jq '.data | {id, code, total_amount, vat_amount, final_amount, payment_method}'

echo
echo "── Stats overview ──────────────────────────────"
curl -s "$API/stats/overview" -H "$AUTH" | jq '.data.summary'
