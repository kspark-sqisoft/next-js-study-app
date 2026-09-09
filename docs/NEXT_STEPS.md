# 추후 추가하면 좋을 학습 항목

README 의 학습 순서(1~22단계)를 마친 뒤 이어서 볼 만한 주제들. 위쪽일수록 우선순위가 높다.
각 항목은 "무엇을 / 왜 / 이 프로젝트 어디에 붙이면 좋은지" 순으로 적었다.

## 라우팅

- **병렬 라우트 · 인터셉팅 라우트** (`@slot`, `(.)` 폴더)
  목록에서 글을 클릭하면 모달로 열리고, 새로고침하면 전체 페이지가 되는 패턴. App Router 고유 기능.
  → `/posts` 목록에서 글 상세를 모달로 여는 `@modal/(.)posts/[id]` 구성.
- **`template.tsx`** — layout 과 달리 이동할 때마다 다시 마운트된다. 페이지 진입 애니메이션 등.
- **`redirect()` / `permanentRedirect()` 와 `next.config` 의 `redirects`** — 옛 URL 을 새 URL 로.

## 에러 처리와 인가 UI

- **`global-error.tsx`** — 루트 레이아웃 자체가 깨졌을 때. `<html>`, `<body>` 를 직접 써야 한다.
- **`forbidden()` / `unauthorized()` 와 `forbidden.tsx` / `unauthorized.tsx`** (`experimental.authInterrupts`)
  → 지금 "남의 글 수정 페이지 → 상세로 redirect" 를 403 페이지로 바꿔 보기.
- **`unstable_rethrow`, `catchError`** — try/catch 가 `redirect()`/`notFound()` 를 삼키지 않게.

## 데이터와 캐싱

- **`"use cache: remote"` 와 `cacheHandlers`** — 서버가 여러 대일 때 Redis 등 공유 캐시.
- **`revalidateTag` 를 Route Handler(웹훅)에서 호출** — 외부 시스템이 콘텐츠를 바꿨을 때 캐시 갱신.
- **`partialPrefetching` 과 `<Link prefetch={true}>`** — 로그인 사용자 전용 페이지의 즉시 이동.
- **트랜잭션** — 글 + 댓글 + 이미지처럼 여러 테이블/파일을 한 번에 바꿀 때 (`BEGIN/COMMIT`).
- **DB 마이그레이션 도구 (Drizzle 또는 Prisma)** — `src/lib/schema.ts` 의 수동 마이그레이션을 도구로 대체. 보류 중이던 "직접 접근 vs Prisma vs tRPC" 비교는 댓글 기능을 소재로.
- **무한 스크롤** — TanStack Query `useInfiniteQuery` + Route Handler 커서 페이지네이션.

## 폼과 클라이언트

- **`useFormStatus`** — 폼 내부 자식 컴포넌트에서 pending 읽기. `PostForm` 의 제출 버튼을 분리해 보기.
- **점진적 향상 확인** — 브라우저 JS 를 끄고 todos 폼이 그대로 동작하는지 보기.
- **react-hook-form + `@hookform/resolvers/zod`** — 같은 Zod 스키마를 브라우저에서도 써서 전송 전 검증. 서버 검증은 유지.
- **`use()` + Context 로 Promise 공유** — 인증 가이드의 `UserProvider` 패턴.
- **클라이언트 전역 상태** (Context, zustand) — 필요해지는 순간에.

## SEO와 메타데이터

- **`generateMetadata` 심화, `opengraph-image.tsx`, `sitemap.ts`, `robots.ts`**
  → 글 상세의 OG 이미지를 `ImageResponse` 로 동적 생성.
- **`next/script`** — 외부 스크립트(분석 도구 등) 로딩 전략.

## API

- **Route Handler 확장** — POST/PATCH/DELETE, 인증 헤더(API 키) 검사, CORS, 상태 코드.
  → `/api/posts` 를 외부에 제공 가능한 REST API 로.
- **tRPC** — 타입 안전한 클라이언트↔서버 호출. Route Handler + fetch 와 비교.

## 보안

- **CSRF** — Server Action 의 origin 검사 원리, Route Handler 에서의 직접 방어.
- **XSS** — `dangerouslySetInnerHTML` 을 써야 할 때의 sanitize. 마크다운 렌더링을 붙이면 자연스럽게 다룬다.
- **Rate limiting** — 로그인 시도 제한. proxy 또는 Route Handler 에서.
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
