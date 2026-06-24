#!/usr/bin/env sh
set -eu

curl -X POST http://localhost:3000/openai/chat-json \
  -H "Content-Type: application/json" \
  -d '{"prompt":"REST API를 한 문장으로 설명해줘."}'
