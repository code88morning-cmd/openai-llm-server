# Chapter3. OpenAI API를 활용한 LLM 백엔드 서버 구현

> NestJS 기반 Q&A API 서버입니다. OpenAI API Key를 환경 변수로 관리하고, Controller-Service-Module 구조와 DTO 검증, Interface, 요청 로깅, curl/Postman 테스트 파일을 포함합니다.

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 프로젝트 명 | OpenAI API를 활용한 LLM 백엔드 서버 구현 |
| 목적 | 사용자의 질문을 REST API로 입력받아 OpenAI API 응답을 반환하는 백엔드 서버 구현 |
| 주요 기술 | NestJS, TypeScript, OpenAI SDK, DTO, class-validator, curl, Postman |
| 기본 포트 | `3000` |
| 핵심 엔드포인트 | `POST /openai/chat` |

---

## 2. 과제 요구사항 매핑

| 과제 Rule | 구현 내용 | 관련 파일 |
|---|---|---|
| rule.1 OpenAI API Key 발급 및 환경 설정 | `.env` 기반 API Key 관리, `.env.example` 제공 | `.env.example`, `src/openai/openai.service.ts` |
| rule.2 REST API 설계 및 구현 | Q&A API 엔드포인트 구현, curl/Postman 테스트 파일 제공 | `src/openai/openai.controller.ts`, `scripts/test-chat.sh`, `postman/*.json` |
| rule.3 Nest.js 서버 개발 | Controller, Service, Module 구조 구현 | `src/openai/openai.controller.ts`, `src/openai/openai.service.ts`, `src/openai/openai.module.ts` |
| DTO 이해 | 요청 Body 검증용 DTO 구현 | `src/openai/dto/*.ts` |
| TypeScript Interface 적용 | 메시지/응답 구조 Interface 정의 | `src/openai/interfaces/*.ts` |
| OpenAI API 연동 | OpenAI SDK를 통한 LLM 응답 생성 | `src/openai/openai.service.ts` |
| 간단한 로깅 시스템 | Interceptor 콘솔 로그, Middleware 파일 로그 | `src/common/interceptors`, `src/common/middleware`, `logs/access.log` |

---

## 3. 폴더 구조

```text
chapter3-openai-llm-server/
├── src/
│   ├── common/
│   │   ├── interceptors/
│   │   │   └── request-logger.interceptor.ts
│   │   └── middleware/
│   │       └── request-logger.middleware.ts
│   ├── openai/
│   │   ├── dto/
│   │   │   ├── chat.completion.dto.ts
│   │   │   ├── chat.prompt.dto.ts
│   │   │   └── chat.request.dto.ts
│   │   ├── interfaces/
│   │   │   ├── chat-message.interface.ts
│   │   │   └── llm-response.interface.ts
│   │   ├── openai.controller.ts
│   │   ├── openai.module.ts
│   │   └── openai.service.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts
├── docs/
│   ├── assignment-report.md
│   └── images/api-test-result.png
├── postman/
│   └── chapter3-openai-llm-server.postman_collection.json
├── scripts/
│   ├── test-chat.sh
│   └── test-chat-json.sh
├── .env.example
├── package.json
└── README.md
```

---

## 4. 실행 방법

### 4.1 의존성 설치

```bash
npm install
```

### 4.2 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 본인 OpenAI API Key를 입력합니다.

```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
PORT=3000
LOG_FILE_PATH=logs/access.log
```

### 4.3 서버 실행

```bash
npm run start:dev
```

실행 확인:

```bash
curl http://localhost:3000/health
```

예상 응답:

```json
{
  "status": "ok",
  "service": "chapter3-openai-llm-server",
  "timestamp": "2026-06-24T00:00:00.000Z"
}
```

---

## 5. REST API 명세

### 5.1 Q&A 텍스트 응답

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| URL | `/openai/chat` |
| Content-Type | `application/json` |
| Request Body | `{ "prompt": "질문 내용" }` |
| Response | LLM 답변 문자열 |

#### curl 테스트

```bash
curl -X POST http://localhost:3000/openai/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Who are you?"}'
```

#### 예상 응답

```text
I am a helpful assistant designed to assist you with any questions or tasks you may have.
```

---

### 5.2 Q&A JSON 응답

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| URL | `/openai/chat-json` |
| Content-Type | `application/json` |
| Request Body | `{ "prompt": "질문 내용" }` |
| Response | 응답 ID, 모델명, 질문, 답변, 생성 시각 |

```bash
curl -X POST http://localhost:3000/openai/chat-json \
  -H "Content-Type: application/json" \
  -d '{"prompt":"REST API를 한 문장으로 설명해줘."}'
```

예상 응답:

```json
{
  "id": "resp_xxxxx",
  "model": "gpt-4o-mini",
  "prompt": "REST API를 한 문장으로 설명해줘.",
  "answer": "REST API는 HTTP 메서드와 URL 자원을 통해 클라이언트와 서버가 데이터를 주고받는 API 설계 방식입니다.",
  "createdAt": "2026-06-24T00:00:00.000Z"
}
```

---

### 5.3 메시지 배열 기반 응답

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| URL | `/openai/chat-messages` |
| Content-Type | `application/json` |
| Request Body | `messages` 배열 |

```bash
curl -X POST http://localhost:3000/openai/chat-messages \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"system", "content":"You are a concise backend tutor."},
      {"role":"user", "content":"NestJS Controller와 Service 차이를 설명해줘."}
    ]
  }'
```

---

## 6. Postman 테스트

Postman에서 아래 파일을 Import합니다.

```text
postman/chapter3-openai-llm-server.postman_collection.json
```

기본 변수:

| 변수 | 값 |
|---|---|
| `baseUrl` | `http://localhost:3000` |

---

## 7. DTO 검증 예시

`prompt`가 비어 있으면 ValidationPipe가 요청을 차단합니다.

```bash
curl -X POST http://localhost:3000/openai/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":""}'
```

예상 응답:

```json
{
  "message": [
    "prompt should not be empty",
    "prompt must be longer than or equal to 2 characters"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

---

## 8. 로깅

요청이 발생하면 콘솔과 `logs/access.log`에 기록됩니다.

예시:

```text
2026-06-24T05:00:00.000Z POST /openai/chat 201 1250ms
```

---

## 9. 제출 체크리스트

- [x] OpenAI API Key 환경 변수 관리
- [x] `.env.example` 제공
- [x] NestJS Controller 구현
- [x] NestJS Service 구현
- [x] NestJS Module 구현
- [x] DTO 기반 Body 검증
- [x] TypeScript Interface 적용
- [x] OpenAI API 연동
- [x] curl 테스트 명령 제공
- [x] Postman Collection 제공
- [x] 요청 로깅 구현
- [x] 테스트 결과 이미지 첨부

---

## 10. Git 업로드 예시

```bash
git init
git add .
git commit -m "Implement NestJS OpenAI LLM backend server"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```
# openai-llm-server
