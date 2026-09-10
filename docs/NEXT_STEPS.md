# 추후 추가하면 좋을 학습 항목

README 의 학습 순서를 마친 뒤 이어서 볼 만한 주제들. 위쪽일수록 우선순위가 높다.
각 항목은 "무엇을 / 왜 / 이 프로젝트 어디에 붙이면 좋은지" 순으로 적었다.

## 라우팅

- **`useSelectedLayoutSegment(s)`** — 현재 활성 세그먼트를 읽어 네비게이션 활성 표시. `/posts` 레이아웃의 링크에 적용해 보기.
- **catch-all 세그먼트** (`[...slug]`, `[[...slug]]`) — 문서 사이트 같은 계층 URL.

## 에러 처리와 인가 UI

- **`global-error.tsx`** — 루트 레이아웃 자체가 깨졌을 때. `<html>`, `<body>` 를 직접 써야 한다.
- **`forbidden()` / `unauthorized()` 와 `forbidden.tsx` / `unauthorized.tsx`** (`experimental.authInterrupts`)
  → 지금 "남의 글 수정 페이지 → 상세로 redirect" 를 403 페이지로 바꿔 보기.
- **`unstable_rethrow`, `catchError`** — try/catch 가 `redirect()`/`notFound()` 를 삼키지 않게. `unstable_rethrow` 는 `src/lib/api/route.ts` 에 이미 적용됐다.

## 데이터와 캐싱

- **`"use cache: remote"` 와 `cacheHandlers`** — 서버가 여러 대일 때 Redis 등 공유 캐시.
- ~~**`revalidateTag` 를 Route Handler 에서 호출**~~ → **완료: Part 5-6.** `updateTag` 는 Server Action 전용이라 `revalidateTag(tag, { expire: 0 })` 를 쓴다.
- **`partialPrefetching` 과 `<Link prefetch={true}>`** — 로그인 사용자 전용 페이지의 즉시 이동.
- **트랜잭션** — 글 + 댓글 + 이미지처럼 여러 테이블/파일을 한 번에 바꿀 때 (`BEGIN/COMMIT`).
- **DB 마이그레이션 도구 (Drizzle 또는 Prisma)** — `src/lib/schema.ts` 의 수동 마이그레이션을 도구로 대체. 보류 중이던 "직접 접근 vs Prisma vs tRPC" 비교는 댓글 기능을 소재로.

## 폼과 클라이언트

- **`useFormStatus`** — 폼 내부 자식 컴포넌트에서 pending 읽기. `PostForm` 의 제출 버튼을 분리해 보기.
- **점진적 향상 확인** — 브라우저 JS 를 끄고 todos 폼이 그대로 동작하는지 보기.
- **react-hook-form + `@hookform/resolvers/zod`** — 같은 Zod 스키마를 브라우저에서도 써서 전송 전 검증. 서버 검증은 유지.
- **`use()` + Context 로 Promise 공유** — 인증 가이드의 `UserProvider` 패턴.
- **zustand 심화** — 서버 데이터를 초기값으로 받는 "요청마다 스토어 생성 Provider" 패턴, `subscribeWithSelector`, devtools 미들웨어.

## SEO와 메타데이터

- **`generateMetadata` 심화, `opengraph-image.tsx`, `sitemap.ts`, `robots.ts`**
  → 글 상세의 OG 이미지를 `ImageResponse` 로 동적 생성.
- **`next/script`** — 외부 스크립트(분석 도구 등) 로딩 전략.

## API

- ~~**Route Handler 확장** — POST/PATCH/DELETE, 인증 헤더(API 키) 검사, CORS, 상태 코드.~~
  → **완료: README Part 5, `/api/v1`.** 기존 `/api/posts` 는 내부용으로 두고 버전 경로에 따로 만들었다.
- **tRPC** — 타입 안전한 클라이언트↔서버 호출. Route Handler + fetch 와 비교.
- **웹훅 수신 엔드포인트** — 서명 검증(HMAC), 재시도·멱등성(같은 이벤트가 두 번 와도 한 번만 처리).
- **API 키 관리 화면** — 지금은 `/api/v1/auth/keys` 로만 발급/폐기할 수 있다. 설정 페이지를 붙여 보기.
- **커서 페이지네이션을 공개 API 에도** — 지금 `/api/v1` 목록은 offset 방식이다. 데이터가 많아지면 커서가 유리하다(`getPostsByCursor` 참고).
- **`OPTIONS` 외 조건부 요청** — `ETag` / `If-None-Match` 로 304 응답.

## 보안

- **CSRF** — Server Action 의 origin 검사 원리, Route Handler 에서의 직접 방어.
- **XSS** — `dangerouslySetInnerHTML` 을 써야 할 때의 sanitize. 마크다운 렌더링을 붙이면 자연스럽게 다룬다.
- ~~**Rate limiting**~~ → **공개 API 에는 적용 완료** (`src/lib/api/rate-limit.ts`, Part 5-5). 남은 것: 로그인 시도 제한, 서버가 여러 대일 때 공유 저장소(Redis).
- **Content Security Policy** — `next.config` 의 `headers` 로 CSP 헤더.

## 성능

- **`@next/bundle-analyzer`** — 번들 크기 확인.
- **`React.cache` 로 요청 내 중복 조회 제거** — `getCurrentUser` 에 이미 적용됨. 다른 조회에도.
- **`after()`** — 응답을 보낸 뒤 로그 기록 같은 후처리.
- **이미지 심화** — `placeholder="blur"`, `remotePatterns`, 업로드 시 서버에서 리사이즈(`sharp`).

## 배포와 운영

- **`output: "standalone"` + Dockerfile** — 컨테이너로 실행.
- **GitHub Actions** — push 마다 `npm run lint && npm test && npm run test:e2e`.
- **환경별 `.env`** — `.env.production`, `.env.local` 우선순위 실험.
- **`instrumentation.ts`, OpenTelemetry** — 요청 추적과 로깅.
- **국제화 (i18n)** — `[locale]` 세그먼트와 `proxy` 로 언어 감지.
