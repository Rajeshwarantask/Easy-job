#!/bin/bash

# Test the pipeline redesign
# Usage: chmod +x TEST_NOW.sh && ./TEST_NOW.sh

echo "================================================"
echo "Testing Pipeline Redesign"
echo "================================================"
echo ""
echo "Step 1: Starting dev server..."
echo "  Command: pnpm dev"
echo "  Waiting for server to start..."
echo ""
echo "In another terminal, run:"
echo ""
echo "Step 2: Trigger sync with debug output"
echo "  Command:"
echo "  curl -X POST http://localhost:3000/api/sync \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"debug\": true}'"
echo ""
echo "Step 3: Watch for output in dev terminal"
echo "  Look for:"
echo "    [Pipeline] Total emails from Gmail: XXX"
echo "    Parsed Emails: XXX"
echo "    Applications Created: XXX"
echo ""
echo "Expected Results:"
echo "  - Total emails: 100+ (was ~100, now fetching 2 years)"
echo "  - Parsed Emails: 50+ (was ~7)"
echo "  - Applications: 20+ (was 7)"
echo ""
echo "================================================"

# Start dev server
pnpm dev
