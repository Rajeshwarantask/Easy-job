#!/bin/bash

# Easy Job App — Pipeline Debug Script
# Usage: ./debug-sync.sh
# 
# This script triggers a sync and shows you exactly where emails are being lost

set -e

echo "=========================================="
echo "Easy Job App — Pipeline Debugger"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Getting your auth token...${NC}"
echo "   (This requires you to be logged in)"
echo ""

# Check if logged in (look for cookie)
if ! curl -s http://localhost:3000/dashboard > /dev/null 2>&1; then
  echo -e "${RED}✗ You're not logged in. Please:"
  echo "  1. Go to http://localhost:3000"
  echo "  2. Sign in with Google"
  echo "  3. Run this script again${NC}"
  exit 1
fi

echo -e "${GREEN}✓ You're logged in${NC}"
echo ""

echo -e "${BLUE}2. Triggering sync with debug mode...${NC}"

# Make the API call with debug flag
RESPONSE=$(curl -s -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"debug": true}' \
  -b "session=*" 2>/dev/null)

echo ""
echo -e "${BLUE}3. Analyzing pipeline...${NC}"
echo ""

# Extract metrics
TOTAL_INPUT=$(echo "$RESPONSE" | grep -o '"totalInputEmails":[0-9]*' | grep -o '[0-9]*' | head -1)
TOTAL_OUTPUT=$(echo "$RESPONSE" | grep -o '"totalOutputApplications":[0-9]*' | grep -o '[0-9]*' | head -1)
LOSS_PCT=$(echo "$RESPONSE" | grep -o '"lossPercentage":"[^"]*' | grep -o '[0-9.]*')
NEW_JOBS=$(echo "$RESPONSE" | grep -o '"newJobs":[0-9]*' | grep -o '[0-9]*' | head -1)
NEW_EVENTS=$(echo "$RESPONSE" | grep -o '"newEvents":[0-9]*' | grep -o '[0-9]*' | head -1)

echo -e "${YELLOW}Pipeline Summary:${NC}"
echo "  Total emails fetched: ${GREEN}$TOTAL_INPUT${NC}"
echo "  Applications created: ${GREEN}$TOTAL_OUTPUT${NC}"
echo "  Email loss: ${YELLOW}$LOSS_PCT%${NC}"
echo ""
echo -e "${YELLOW}Sync Results:${NC}"
echo "  New jobs: ${GREEN}$NEW_JOBS${NC}"
echo "  New events: ${GREEN}$NEW_EVENTS${NC}"
echo ""

# Show full response
echo -e "${BLUE}4. Full debug output:${NC}"
echo ""
echo "$RESPONSE" | jq '.debug.stages' 2>/dev/null || echo "$RESPONSE"
echo ""

echo -e "${GREEN}✓ Sync complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  • Check your dashboard for the new jobs"
echo "  • Run this script again to see progress"
echo "  • See PIPELINE_DEBUG_GUIDE.md for detailed analysis"
echo ""
