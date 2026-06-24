#!/bin/sh
curl -X POST http://localhost:3000/openai/rag \
  -H "Content-Type: application/json" \
  -d '{"prompt":"운영체제에서 프로세스와 스레드 차이를 설명해줘.","topK":3}'
