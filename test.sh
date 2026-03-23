#!/bin/bash
# Hash21 Backend — Test Suite
API="https://hash21-backend.vercel.app/api"
PASS=0; FAIL=0
pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo ""
echo "⚡ Hash21 Backend Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Health
echo "🔧 Health"
R=$(curl -s "$API/health")
echo "$R" | grep -q '"ok"' && pass "GET /health → 200" || fail "GET /health"

# Zap — valid request
echo "⚡ Zap API"
R=$(curl -s -X POST "$API/zap" -H "Content-Type: application/json" -d '{"target":"libertad","amount":21,"message":"test"}')
echo "$R" | grep -q '"invoice"' && pass "POST /zap → invoice generated" || fail "POST /zap no invoice"
echo "$R" | grep -q '"sig"' && pass "POST /zap → NIP-57 signed" || fail "POST /zap no signature"
echo "$R" | grep -q '9734' && pass "POST /zap → kind 9734" || fail "POST /zap wrong kind"
echo "$R" | grep -q '"p"' && pass "POST /zap → has p tag" || fail "POST /zap no p tag"
echo "$R" | grep -q 'walletofsatoshi' && pass "POST /zap → Lightning Address WoS" || fail "POST /zap wrong LN address"

# Zap — missing params
R=$(curl -s -X POST "$API/zap" -H "Content-Type: application/json" -d '{}')
echo "$R" | grep -q '"error"' && pass "POST /zap {} → error returned" || fail "POST /zap {} no error"

R=$(curl -s -X POST "$API/zap" -H "Content-Type: application/json" -d '{"target":"x"}')
echo "$R" | grep -q '"error"' && pass "POST /zap no amount → error" || fail "POST /zap no amount accepted"

# Check — unpaid
echo "🔍 Check API"
R=$(curl -s "$API/check?zapRequestId=fake123&recipientPubkey=a78a391888c6a7a2e114ad66dc0e473b9f561734c7f098c9552b2e5bb840d26c&since=1773876000")
echo "$R" | grep -q '"paid":false' && pass "GET /check fake → paid:false" || fail "GET /check fake"

# Check — missing params
R=$(curl -s "$API/check")
echo "$R" | grep -q '"error"' && pass "GET /check no params → error" || fail "GET /check no params accepted"

# Artists CRUD
echo "👥 Artists CRUD"
R=$(curl -s "$API/artists")
echo "$R" | grep -q '\[' && pass "GET /artists → array" || fail "GET /artists"
COUNT=$(echo "$R" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$COUNT" -gt 0 ] && pass "GET /artists → $COUNT artists" || fail "GET /artists empty"

# Works CRUD
echo "🎨 Works CRUD"
R=$(curl -s "$API/works")
echo "$R" | grep -q '\[' && pass "GET /works → array" || fail "GET /works"
COUNT=$(echo "$R" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$COUNT" -gt 0 ] && pass "GET /works → $COUNT works" || fail "GET /works empty"

# Products CRUD
echo "🛒 Products CRUD"
R=$(curl -s "$API/products")
echo "$R" | grep -q '\[' && pass "GET /products → array" || fail "GET /products"
COUNT=$(echo "$R" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$COUNT" -gt 0 ] && pass "GET /products → $COUNT products" || fail "GET /products empty"

# Create + Delete test product
R=$(curl -s -X POST "$API/products" -H "Content-Type: application/json" -d '{"name_es":"TEST_DELETE","name_en":"TEST_DELETE","status":"hidden"}')
ID=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$ID" ] && pass "POST /products → created (id: ${ID:0:8}...)" || fail "POST /products create"

if [ -n "$ID" ]; then
  R=$(curl -s -X DELETE "$API/products?id=$ID")
  echo "$R" | grep -q '"deleted":true' && pass "DELETE /products → deleted" || fail "DELETE /products"
fi

# Upload endpoint exists
echo "📦 Upload"
R=$(curl -s -X POST "$API/upload" -H "Content-Type: application/json" -d '{}')
echo "$R" | grep -q '"error"' && pass "POST /upload {} → error (no crash)" || fail "POST /upload crashed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS+FAIL))
echo "  Total: $TOTAL | ✅ $PASS passed | ❌ $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "  🏆 All tests passed!" || echo "  ⚠️ $FAIL test(s) failed"
echo ""
exit $FAIL
