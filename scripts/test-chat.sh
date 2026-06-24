#!/usr/bin/env sh
set -eu

curl -X POST http://localhost:3000/openai/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Who are you?"}'
