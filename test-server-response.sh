#!/bin/bash
# Test script to verify server response format

SERVER_URL="https://nouakchott-destination-backend-production.up.railway.app/api/destination-from-audio"

echo "Testing server response format..."
echo "=================================="
echo ""

# Test 1: Valid destination (should return destination object)
echo "Test 1: Valid destination (toujounin.wav)"
echo "----------------------------------------"
curl -X POST "$SERVER_URL" \
  -F "audio=@clips/toujounin.wav" \
  -H "Content-Type: multipart/form-data" \
  2>/dev/null | jq '.'
echo ""
echo ""

# Test 2: Invalid destination (should return destination: null)
echo "Test 2: Invalid destination (akjojet1.wav)"
echo "----------------------------------------"
curl -X POST "$SERVER_URL" \
  -F "audio=@clips/akjojet1.wav" \
  -H "Content-Type: multipart/form-data" \
  2>/dev/null | jq '.'
echo ""
echo ""

echo "=================================="
echo "Expected response format:"
echo "- transcript: string"
echo "- normalizedTranscript: string"
echo "- destination: object | null"
echo "  - id: number"
echo "  - canonicalName: string"
echo "  - matchedVariant: string"
echo "  - lat: number"
echo "  - lon: number"
echo "  - confidence: number"
echo "  - matchedBy: 'fuzzy' | 'llm'"
echo "- error: string | null"

