# next-js-study-app

Next.js 16 (App Router) 학습용 프로젝트. SQLite 를 붙인 작은 앱 두 개(todos, posts)에 핵심 개념을 하나씩 심어 두었다.
**README 의 개념 설명 → 해당 파일의 주석 → 브라우저에서 동작 확인** 순서로 보면 된다.

## 스택

- Next.js 16 (App Router, Turbopack, Cache Components)
- React 19, TypeScript
- Tailwind CSS v4, shadcn/ui (style: base-nova)
- SQLite (Node.js 내장 `node:sqlite`, 별도 패키지 없음)
- SWR, TanStack Query (클라이언트 사이드 페칭 비교용)
- Zod (폼 검증)
- jose (세션 JWT 서명). 비밀번호 해시는 Node 내장 crypto.scrypt
- 공개 REST API `/api/v1` (Bearer 인증, 레이트 리밋, OpenAPI 3.1 명세)
- Vitest + React Testing Library (단위/컴포넌트 테스트), Playwright (E2E)
- ESLint

## 시작하기

```bash
npm install
cp .env.example .env   # DB 파일 경로 + 세션 서명 키
# .env 의 SESSION_SECRET 을 아래 명령 결과로 바꾼다
openssl rand -base64 32
npm run db:seed        # 샘플 데이터 넣기 (계정 2개 포함)
npm run dev            # http://localhost:3000
```

공개 REST API 는 `http://localhost:3000/api/v1` 에 있다 (명세: `/api/v1/openapi.json`). 자세한 내용은 [Part 5](#part-5-공개-api-apiv1--외부-개발자에게-열어-주기).

그 외 명령:

```bash
npm run build          # 프로덕션 빌드. 라우트별 렌더링 방식(○ ◐ ƒ)이 출력된다
npm run start          # 빌드 결과 실행
npm run lint
npm test               # 단위/컴포넌트 테스트 (Vitest)
npm run test:e2e       # 브라우저 E2E 테스트 (Playwright)
npm run db:init        # DB 파일/테이블만 생성 (앱 첫 실행 시 자동으로도 됨)
npm run db:seed -- --reset   # 샘플 데이터로 초기화
```

샘플 계정 (비밀번호는 둘 다 `password123`):

| 이메일 | 이름 | 용도 |
| --- | --- | --- |
| demo@example.com | 데모 | 샘플 글 대부분의 작성자 |
| guest@example.com | 게스트 | "남의 글은 읽기만" 되는지 확인할 때 |

---

## 렌더링 방식 개념 (SSG · SSR · CSR · ISR)

"HTML 을 **언제, 어디서** 만드는가" 로 구분한다. 이 프로젝트에서 각 방식이 어디에 쓰였는지 함께 적었다.

| 방식 | 언제 | 어디서 | 장점 | 단점 | 이 프로젝트 |
| --- | --- | --- | --- | --- | --- |
| **SSG** (Static Site Generation) | 빌드 시 1회 | 서버(빌드 머신) | 가장 빠름. CDN 에 그대로 올릴 수 있음 | 데이터가 바뀌면 다시 빌드해야 함 | `/`, `/client-fetch` |
| **SSR** (Server-Side Rendering) | 요청마다 | 서버 | 항상 최신 데이터. 첫 화면에 내용이 있어 SEO 유리 | 요청마다 서버 부하. 응답까지 기다려야 함 | `/todos`, `/api/*` |
| **CSR** (Client-Side Rendering) | 브라우저에서 JS 실행 후 | 브라우저 | 상호작용이 풍부. 서버 부담 적음 | 첫 화면이 비어 있음(로딩). SEO 불리 | `/client-fetch` 의 검색 결과, `"use client"` 컴포넌트의 상호작용 |
| **ISR** (Incremental Static Regeneration) | 빌드 시 1회 + 주기/이벤트로 재생성 | 서버 | SSG 의 속도 + 데이터 갱신 가능 | 갱신 직후 잠깐 이전 데이터가 보일 수 있음 | `/posts` 목록, `/posts/[id]` 상세 |

### SSG — 미리 만들어 두기

빌드할 때 HTML 을 만들어 두고, 요청이 오면 그 파일을 그대로 준다. 방문자 수와 무관하게 서버가 일을 하지 않는다.
App Router 에서는 **요청별 데이터를 안 쓰면 자동으로 SSG** 가 된다. `src/app/page.tsx` 에 아무 설정이 없는데 빌드 결과에 `○ Static` 으로 나오는 이유다.

### SSR — 요청마다 만들기

요청이 올 때마다 서버가 DB 를 읽고 HTML 을 만들어 준다. 항상 최신이지만 매번 비용이 든다.
`/todos` 가 SSR 인 이유는 `src/lib/todos.ts` 의 `await connection()` 때문이다. "요청이 들어온 다음에 실행하라" 는 표시라서, 이 줄이 없으면 빌드 시점에 한 번 실행되어 SSG 가 되어 버린다.

### CSR — 브라우저에서 만들기

서버는 거의 빈 HTML 과 JS 만 주고, 브라우저가 JS 를 실행해 API 를 호출하고 화면을 그린다. 예전 SPA(React 만 쓰던 시절) 의 기본 방식이다.
App Router 에서 순수 CSR 은 드물다. `/client-fetch` 가 가장 가깝다: 페이지 뼈대는 SSG 로 미리 만들어지고, **검색 결과만** 브라우저에서 `/api/posts` 를 호출해 그린다.

또 하나 중요한 점: `"use client"` 컴포넌트도 **서버에서 먼저 HTML 로 렌더링된다.** 브라우저에서는 그 HTML 위에 JS 가 붙어 살아나는데(hydration), 이때부터 클릭·입력 같은 상호작용이 동작한다. 즉 App Router 의 한 페이지 안에는 SSR/SSG 로 만든 HTML 과 CSR 로 동작하는 상호작용이 섞여 있다.

### ISR — 미리 만들되 갱신하기

SSG 처럼 미리 만들어 두지만, 조건이 되면 서버가 **백그라운드에서 다시 만든다.** 방문자는 항상 캐시된 페이지를 즉시 받고, 갱신은 뒤에서 일어난다.

갱신 조건 두 가지:
- **시간**: `cacheLife("minutes")` → 1분이 지난 뒤 첫 요청에서 재생성. 빌드 결과의 `Revalidate 1m`.
- **이벤트**: 글을 쓰거나 지울 때 `updateTag("posts")` / `revalidateTag("posts", "max")` 로 즉시 무효화.

Next.js 16 에서는 ISR 을 별도 설정이 아니라 `"use cache"` + `cacheLife` + `cacheTag` 조합으로 표현한다. `/posts` 목록 상단의 "캐시 생성 시각" 이 새로고침해도 안 바뀌다가, 1분 뒤 또는 버튼을 누르면 바뀌는 것이 ISR 의 동작이다.

### Partial Prerender 와 스트리밍 — 한 페이지에 섞기

위 네 가지는 "페이지 단위" 구분이다. Next.js 16 은 여기에 **한 페이지 안에서 부분별로 다르게** 하는 방식을 더했다.

- 정적인 부분(레이아웃, 제목, 캐시된 데이터)은 빌드 시 만들어 **정적 셸** 로 즉시 보낸다.
- 동적인 부분(`connection()`, `params`, 느린 조회)은 `<Suspense>` 로 감싸 두면 **나중에 스트리밍** 되어 채워진다.
- 빌드 결과의 `◐ Partial Prerender` 가 이것이다. `/posts/[id]` 에서 본문은 즉시 나오고 "다른 글" 이 1.5초 뒤에 채워지는 것, `/todos` 에서 스켈레톤이 먼저 보이는 것이 예다.

### 어떤 것을 골라야 하나

- 바뀌지 않는 페이지(소개, 약관) → SSG
- 자주 바뀌지만 약간 늦어도 되는 목록(블로그, 상품 목록) → ISR
- 사용자마다 다르거나 항상 최신이어야 하는 것(대시보드, 장바구니) → SSR + Suspense
- 입력에 따라 계속 바뀌는 것(검색, 자동완성, 실시간) → CSR (SWR / TanStack Query)

실제로는 한 페이지 안에서 이것들을 섞는다. "페이지 뼈대는 정적, 데이터 영역은 스트리밍, 검색창은 클라이언트" 처럼.

---

## 학습 순서

아래 순서대로 따라가면 "서버에서 데이터를 읽고 → 바꾸고 → 캐시하고 → 브라우저에서 가져오는" 흐름을 한 바퀴 돌게 된다.

| 단계 | 주제 | 어디서 |
| --- | --- | --- |
| 0 | 렌더링 방식 개념 (SSG · SSR · CSR · ISR) | 위 섹션 |
| 1 | 프로젝트 구조, 레이아웃, 페이지, 정적 렌더링 | `src/app/layout.tsx`, `src/app/page.tsx` |
| 2 | SQLite 연결과 데이터 접근 계층 | `src/lib/db.ts`, `src/lib/todos.ts` |
| 3 | 서버 컴포넌트 데이터 조회 (SSR) | `src/app/todos/page.tsx` |
| 4 | Server Action 으로 데이터 변경 | `src/app/todos/actions.ts` |
| 5 | 클라이언트 컴포넌트와 React 19 훅 | `src/app/todos/*.tsx` |
| 6 | Route Handler (REST API) | `src/app/api/todos/route.ts` |
| 7 | Cache Components: `"use cache"`, ISR | `src/lib/posts.ts`, `src/app/posts/page.tsx` |
| 8 | 캐시 무효화: `updateTag` vs `revalidateTag` | `src/app/posts/actions.ts`, `cache-controls.tsx` |
| 9 | 동적 라우트 `[id]`, `generateStaticParams` | `src/app/posts/[id]/page.tsx` |
| 10 | 특수 파일: `loading`, `error`, `not-found` | `src/app/posts/[id]/`, `src/app/posts/error.tsx` |
| 11 | Suspense 스트리밍 | `src/app/posts/[id]/other-posts.tsx` |
| 12 | 클라이언트 사이드 페칭: fetch, SWR, TanStack Query | `src/app/(demos)/client-fetch/` |
| 13 | 폼 검증: 손 검증 vs Zod 스키마 | `src/app/todos/actions.ts` vs `src/lib/schemas/post.ts` |
| 14 | 인증: 회원 가입, 로그인, 세션 쿠키(JWT) | `src/lib/password.ts`, `src/lib/session.ts`, `src/app/(auth)/` |
| 15 | 인가: DAL, 작성자만 수정/삭제, proxy | `src/lib/dal.ts`, `src/app/posts/actions.ts`, `src/proxy.ts` |
| 16 | Cache Components 에서 세션 다루기 | `src/app/layout.tsx`, `src/app/posts/[id]/page.tsx` |
| 17 | 2단 댓글: 트리 조립, CASCADE, 태그별 캐시 | `src/lib/comments.ts`, `src/app/posts/[id]/comments-section.tsx` |
| 18 | 테스트: 단위 · 컴포넌트 · Route Handler · E2E | `src/**/*.test.ts(x)`, `e2e/`, Part 4 |
| 19 | `searchParams`: URL 로 검색·페이지네이션 상태 관리 | `src/app/posts/page.tsx`, `getPostsPage` |
| 20 | 외부 API `fetch` 캐시 + `use()` 로 Promise 넘기기 | `src/lib/github.ts`, `src/app/(demos)/releases/` |
| 21 | 이미지 업로드, 파일 응답 Route Handler, `next/image` | `src/lib/uploads.ts`, `src/app/api/uploads/[name]/route.ts` |
| 22 | `next/dynamic` (`ssr: false`) 로 브라우저 전용 컴포넌트 지연 로딩 | `src/app/posts/[id]/recently-viewed*.tsx` |
| 23 | 무한 스크롤: 커서 페이지네이션 + `useInfiniteQuery` + IntersectionObserver | `src/app/(demos)/feed/`, `getPostsByCursor` |
| 24 | 병렬 라우트 + 인터셉팅 라우트로 모달 | `src/app/posts/@modal/`, `src/components/modal.tsx` |
| 25 | `template.tsx` 와 layout 의 차이 | `src/app/(demos)/template.tsx` |
| 26 | 리다이렉트: `redirects` 설정, `redirect()`, `permanentRedirect()` | `next.config.ts`, `src/app/p/[id]/page.tsx` |
| 27 | 공개 API 설계: 버전 경로, 응답 봉투, 에러 코드 | `src/lib/api/http.ts`, `src/app/api/v1/`, Part 5 |
| 28 | Bearer 인증: 액세스 토큰(JWT) vs API 키(해시 저장) | `src/lib/api/auth.ts`, `src/lib/api-keys.ts` |
| 29 | 레이트 리밋과 CORS | `src/lib/api/rate-limit.ts`(5-6), `src/proxy.ts`(5-10) |
| 30 | Route Handler 의 캐시 무효화 (`updateTag` 를 못 쓰는 이유) | `src/app/api/v1/posts/route.ts` |
| 31 | OpenAPI 명세로 API 문서화 | `src/lib/api/openapi.ts`, `/api/v1/openapi.json` |

이후에 볼 항목은 [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) 에 정리해 두었다.

---

## Part 1. todos — 서버 컴포넌트, Server Action, 기본 CRUD

경로 `/todos`. 할 일 추가 / 완료 토글 / 제목 수정 / 삭제 / 완료 항목 일괄 삭제.

### 1-1. 렌더링 방식: SSG 와 SSR

- `/` 홈은 요청별 데이터가 없어 **빌드 시 정적 HTML** 로 만들어진다 (SSG). `src/app/page.tsx` 에 특별한 설정이 없는데도 그렇게 되는 것이 App Router 의 기본 동작이다.
- `/todos` 는 **요청마다 DB 를 읽는다** (SSR). 이렇게 만드는 스위치는 `src/lib/todos.ts` 의 `await connection()` 한 줄이다.
- 왜 필요한가: `node:sqlite` 는 동기 드라이버라 그냥 호출하면 빌드 시점에 실행되어 결과가 HTML 에 굳어버린다. `connection()` 은 "요청이 들어온 뒤에 실행하라" 는 표시다. 실험: 이 줄을 지우고 `npm run build` 하면 `/todos` 가 `○ Static` 으로 바뀐다.

### 1-2. 데이터 접근 계층 (`src/lib/`)

- `db.ts`: SQLite 연결 하나를 앱 전체에서 공유. 개발 모드 HMR 로 모듈이 다시 로드돼도 연결이 중복 생성되지 않도록 `globalThis` 에 캐시한다. 맨 위의 `import "server-only"` 는 클라이언트 컴포넌트에서 실수로 import 하면 빌드 에러를 내는 안전장치.
- `todos.ts`: SQL 은 이 파일에만 둔다. DB 행(snake_case, 0/1) 을 앱 타입(camelCase, boolean) 으로 변환하는 `toTodo` 패턴.
- 환경 변수: DB 경로는 `.env` 의 `DATABASE_PATH`. Next.js 가 `.env` 를 자동 로드하고, `scripts/` 는 `node --env-file` 로 직접 읽는다.

### 1-3. 서버 컴포넌트에서 데이터 읽기

`src/app/todos/page.tsx` 는 `async` 컴포넌트다. `"use client"` 가 없으므로 서버에서만 실행되고, `await getTodos()` 로 DB 를 직접 읽어 클라이언트 컴포넌트에 props 로 넘긴다. fetch 도, useEffect 도, API 도 필요 없다.

### 1-4. Server Action 으로 데이터 바꾸기

`src/app/todos/actions.ts` 맨 위의 `"use server"` 가 이 파일의 모든 export 를 Server Action 으로 만든다.

- 클라이언트 컴포넌트에서 일반 함수처럼 `await toggleTodoAction(id, true)` 하면 내부적으로 POST 요청이 나가고 서버에서 실행된다.
- 데이터를 바꾼 뒤 `revalidatePath("/todos")` 를 호출하면 서버가 페이지를 다시 렌더링해 응답에 실어 보내고, 화면이 갱신된다.
- 입력 검증(`parseTitle`)은 반드시 서버 쪽에서 한다. 브라우저의 `required`, `maxLength` 는 편의일 뿐 우회 가능하다.

### 1-5. 클라이언트 컴포넌트와 React 19 훅

상호작용이 필요한 부분만 `"use client"` 로 분리했다.

| 파일 | 훅 | 배우는 것 |
| --- | --- | --- |
| `add-todo-form.tsx` | `useActionState` | 폼 `action` 에 Server Action 연결. `[상태, 액션, pending]` 세 값을 돌려준다 |
| `todo-item.tsx` | `useOptimistic` | 서버 응답 전에 화면을 먼저 바꾸는 낙관적 업데이트. 액션이 끝나면 실제 값으로 동기화 |
| `todo-item.tsx` | `useTransition` | 액션 실행 중 `isPending` 으로 로딩 표시 |
| `clear-completed-button.tsx` | `useTransition` | 버튼 클릭 이벤트에서 Server Action 을 호출하는 가장 단순한 형태 |

App Router 의 CSR 은 "빈 HTML 에 JS 로 전부 그리기" 가 아니다. 서버가 그린 HTML 위에 클라이언트 컴포넌트만 hydration 되어 살아난다. 한 페이지 안에 SSR 과 CSR 이 섞여 있다.

### 1-6. Route Handler

`src/app/api/todos/route.ts` 의 `GET()` 은 `/api/todos` 로 오는 HTTP 요청을 처리한다. Server Action 과의 차이:

| | Route Handler | Server Action |
| --- | --- | --- |
| 형태 | REST API. URL + HTTP 메서드 | 함수 호출 |
| 호출 주체 | 누구나 (외부 시스템, 모바일 앱, curl) | 같은 앱의 React 컴포넌트 |
| 용도 | 외부에 API 공개, 웹훅, 파일 응답 | 폼 제출, 버튼 클릭 같은 앱 내부 변경 |

---

## Part 2. posts — 캐싱, 동적 라우트, 스트리밍, 클라이언트 페칭

경로 `/posts`. `next.config.ts` 의 `cacheComponents: true` 가 이 파트의 전제다.

### 2-1. Cache Components 모델

Next.js 16 의 캐싱 규칙은 단순하다.

- **기본은 캐시하지 않는다.** 캐시하고 싶은 함수/컴포넌트에만 `"use cache"` 를 붙인다.
- `cacheLife("minutes")` 로 수명을, `cacheTag("posts")` 로 무효화용 이름표를 붙인다.
- **캐시되지 않은 동적 데이터** (`connection()`, `cookies()`, `params` 등) 는 반드시 `<Suspense>` 또는 `loading.tsx` 안에 있어야 한다. 그래야 정적 셸을 먼저 보내고 나머지를 스트리밍할 수 있다. 어기면 빌드 에러가 안내한다.
- 이 규칙 때문에 `/todos` 에 `loading.tsx` 를 추가했고, `/api/todos` 는 `connection()` 을 넣어야 정적으로 굳지 않는다.

`src/lib/posts.ts` 를 보면 캐시되는 함수(`getPosts`, `getPost`) 와 안 되는 함수(`getOtherPosts`, `searchPosts`) 가 나뉘어 있다.

### 2-2. ISR (Incremental Static Regeneration)

"정적으로 만들어 두고, 시간이 지나거나 이벤트가 생기면 다시 만든다."

- `/posts` 목록: `getPosts()` 에 `cacheLife("minutes")`. 빌드 결과에 `Revalidate 1m` 으로 표시된다. 1분이 지난 뒤 첫 요청에서 백그라운드로 재생성된다.
- 화면에 **캐시 생성 시각** 을 표시해 두었다. 새로고침해도 시각이 안 바뀌면 캐시가 동작하는 것이다.
- `/posts/[id]` 상세: `getPost(id)` 에 `cacheLife("hours")`. 인자 `id` 가 캐시 키에 들어가 글마다 별도 엔트리가 만들어진다.

### 2-3. 캐시 무효화 두 가지 (`src/app/posts/actions.ts`)

| 함수 | 동작 | 언제 |
| --- | --- | --- |
| `updateTag("posts")` | 즉시 만료. 다음 요청은 새 데이터를 만들 때까지 기다린다 | 내가 방금 쓴 글이 바로 보여야 할 때 (read-your-own-writes). Server Action 에서만 호출 가능 |
| `revalidateTag("posts", "max")` | 다음 요청엔 기존 캐시를 주고 백그라운드에서 재생성 (stale-while-revalidate) | 약간 늦게 반영돼도 되는 경우. Route Handler 에서도 호출 가능 |

`/posts` 상단의 두 버튼(`cache-controls.tsx`)으로 차이를 직접 볼 수 있다. `updateTag` 는 누르자마자 시각이 바뀌고, `revalidateTag` 는 한 번 더 새로고침해야 바뀐다.

### 2-4. 동적 라우트와 generateStaticParams (`src/app/posts/[id]/page.tsx`)

- 폴더 이름 `[id]` 가 URL 의 해당 부분을 `params` 로 넘겨준다. `params` 는 Promise 라 `await` 해야 한다.
- `generateStaticParams` 가 돌려준 id(최신 2개) 는 **빌드 시 완전히 렌더링** 된다. 빌드 결과에 `/posts/5`, `/posts/4` 가 따로 보이는 이유다.
- 나머지 id 는 **첫 요청 때 렌더링** 되고, `getPost` 가 캐시되어 두 번째부터는 빠르다. Cache Components 에서는 최소 1개는 돌려줘야 한다.
- `params` 를 페이지 최상위에서 await 하지 않고 `<Suspense>` 안의 자식(`PostDetail`) 에서 await 한다. 그래야 "id 와 무관한 정적 셸" 이 만들어져 처음 보는 id 도 셸을 즉시 보낼 수 있다.

### 2-5. 특수 파일: loading, error, not-found

같은 폴더에 두면 Next.js 가 자동으로 감싸 준다. 감싸는 순서는 `layout > error > loading > not-found > page`.

| 파일 | 역할 | 확인 방법 |
| --- | --- | --- |
| `[id]/loading.tsx` | page 를 `<Suspense fallback>` 으로 감싼다 | 목록에서 글 클릭 시 스켈레톤이 먼저 보임 |
| `[id]/not-found.tsx` | `notFound()` 호출 시 렌더링 | `/posts/9999`, `/posts/abc` |
| `posts/error.tsx` | Error Boundary. 반드시 클라이언트 컴포넌트 | 글 상세의 "에러 발생시키기" 버튼 → "다시 시도" 로 `retry()` |

`error-trigger.tsx` 는 렌더 단계에서 throw 한다. 이벤트 핸들러 안의 throw 는 Error Boundary 가 잡지 못하기 때문이다.

### 2-6. Suspense 스트리밍

글 상세 하단의 "다른 글" (`other-posts.tsx`) 은 `getOtherPosts` 가 일부러 1.5초 걸린다. `<Suspense>` 로 감싸 두었기 때문에 본문은 즉시 나오고 이 부분만 나중에 채워진다.

curl 로 보면 첫 바이트(TTFB) 는 수 ms, 전체 완료는 1.5초다. 서버가 HTML 을 조각내어 순서대로 보내는 것이 스트리밍이다.

### 2-7. 클라이언트 사이드 페칭 (`src/app/(demos)/client-fetch/`)

서버 컴포넌트가 아니라 브라우저에서 `/api/posts` 를 호출한다. 검색처럼 사용자 입력에 따라 계속 바뀌는 데이터에 적합하다. 같은 검색 기능을 세 가지로 구현해 비교한다.

| 파일 | 방식 | 특징 |
| --- | --- | --- |
| `post-count.tsx` | `useEffect` + `fetch` | 라이브러리 없음. 로딩/에러/취소(`AbortController`) 를 직접 처리해야 한다 |
| `post-search.tsx` | SWR `useSWR(key, fetcher)` | 키(URL) 기반 캐시, 중복 요청 제거, 포커스 시 자동 갱신. 작고 단순 |
| `post-search-query.tsx` | TanStack Query `useQuery({ queryKey, queryFn })` | 배열 쿼리 키, 풍부한 옵션, DevTools. `src/components/query-providers.tsx` 의 `QueryClientProvider` 가 필요 |

SWR 과 TanStack Query 는 같은 문제를 푸는 경쟁 라이브러리다. Next.js 의 `"use cache"` 가 **서버 캐시** 라면 이들은 **브라우저 캐시** 로, 층위가 달라 대체 관계가 아니다.

`QueryClientProvider` 는 `src/app/(demos)/layout.tsx` 에서 데모 페이지 그룹에만 적용했다. 앱 전체(root layout)에 두지 않은 것은 필요한 범위에만 두기 위해서다.

### 2-8. 폼 검증: 손 검증 vs Zod

같은 "서버에서 입력값 검증" 을 두 방식으로 구현해 두었다. 어느 쪽이든 **검증은 서버에서** 한다. 브라우저의 `required`, `maxLength` 는 편의일 뿐 우회할 수 있다.

| | 손 검증 — todos | Zod — posts |
| --- | --- | --- |
| 파일 | `src/app/todos/actions.ts` 의 `parseTitle` | `src/lib/schemas/post.ts` + `src/app/posts/actions.ts` |
| 규칙 정의 | `if` 문 나열 | `z.object({...})` 스키마 하나에 선언 |
| 에러 형태 | 문자열 하나 (`{ error: "..." }`) | 필드별 배열 (`{ title: [...], content: [...] }`) |
| 화면 표시 | 토스트 한 번 | 각 입력창 아래에 해당 메시지 |
| 타입 | 직접 작성 | `z.infer<typeof schema>` 로 자동 추출 |
| 재사용 | 어려움 | 같은 스키마를 API, 브라우저 검증에도 사용 가능 |

판단 기준: 필드가 하나뿐인 todos 는 손 검증이 더 짧고 명확하다. 필드가 여럿이고 각각 다른 메시지가 필요한 posts 부터 Zod 가 값어치를 한다.

Zod 쪽 핵심 코드 흐름 (`createPostAction`):
1. `formData` 에서 값을 꺼내 문자열로 만든다.
2. `postSchema.safeParse(raw)` — 예외 대신 `{ success, data | error }` 를 돌려준다.
3. 실패면 `z.flattenError(error).fieldErrors` 와 입력값을 함께 반환한다. 폼이 `useActionState` 로 받아 표시한다.
4. 성공이면 `result.data` 는 trim 이 적용된 `PostInput` 타입이다.

확인 방법: `/posts` 하단 폼에서 빈 제목, 101자 제목, 빈 내용을 넣어 보면 입력창별로 다른 메시지가 붙는다. 폼에 `noValidate` 를 둬서 브라우저 검증을 끄고 서버 검증만 보이게 했다.

다음 단계로는 같은 스키마를 브라우저에서도 써서 전송 전에 검증하는 방식(react-hook-form + `@hookform/resolvers/zod`)이 있다. 이때도 서버 검증은 그대로 둔다.

### 2-9. `searchParams` 로 검색과 페이지네이션 (`src/app/posts/page.tsx`)

검색어와 페이지 번호를 컴포넌트 state 가 아니라 **URL** 에 둔다 (`/posts?q=스트리밍&page=2`). 새로고침, 뒤로 가기, 링크 공유가 모두 자연스럽게 동작한다.

- `searchParams` 는 `params` 처럼 Promise 이고, **요청 시점 데이터** 다. Cache Components 에서는 이걸 읽는 컴포넌트(`PostList`)만 `<Suspense>` 안에 두고, 제목/버튼은 정적 셸에 남긴다.
- 캐시 함수 안에서는 요청 API 를 읽을 수 없으므로 값을 꺼낸 뒤 **인자로** 넘긴다: `getPostsPage(query, page)`. 인자가 캐시 키에 들어가 "검색어 × 페이지" 조합마다 별도 엔트리가 생기고, 태그(`posts`)는 같아서 글이 바뀌면 전부 무효화된다.
- 검색 폼은 `<form method="get">`. JS 없이도 브라우저가 `?q=` 로 이동시켜 준다. 페이지 링크는 `<Link href="/posts?q=...&page=2">`.
- 잘못된 값(`page=abc`, `page=999`)은 서버에서 보정한다. URL 은 사용자 입력이다.

### 2-10. 외부 API `fetch` 와 `use()` (`src/lib/github.ts`, `/releases`)

GitHub API 에서 Next.js 릴리스 목록을 가져온다. 두 가지를 배운다.

**외부 fetch 캐시**: Cache Components 에서는 DB 조회와 똑같이 `"use cache"` + `cacheLife("hours")` + `cacheTag` 로 감싼다. 예전 모델의 `fetch(url, { next: { revalidate: 3600, tags } })` 옵션이 이렇게 바뀌었다. 실패하면 throw 하는데, 던져진 에러는 캐시되지 않아 다음 요청에서 다시 시도되고 화면에서는 `error.tsx` 가 잡는다. "다시 가져오기" 버튼은 `updateTag` 로 캐시를 지운다. 외부 데이터든 DB 데이터든 무효화 방법이 같다.

**`use()` 패턴**: 서버 컴포넌트가 `getNextReleases()` 를 **await 하지 않고** Promise 를 만들어 `<Suspense>` 안의 클라이언트 컴포넌트(`release-list.tsx`)에 props 로 넘긴다. 클라이언트는 `use(promise)` 로 값을 꺼낸다. 데이터 가져오기는 서버가, 필터 토글 같은 상호작용은 클라이언트가 맡는 분업이다. 스트리밍의 다른 절반이라고 보면 된다.

### 2-11. 이미지 업로드와 `next/image` (`src/lib/uploads.ts`, `/api/uploads/[name]`)

- 폼에 `<input type="file" name="image">` 를 두면 Server Action 이 `formData.get("image")` 로 `File` 을 받는다. 별도 업로드 API 가 필요 없다.
- 파일은 `data/uploads/` 에 서버가 만든 UUID 이름으로 저장하고 DB 에는 파일명만 둔다. `public/` 에 두지 않는 이유는 배포 환경에서 런타임에 추가한 파일이 서빙되지 않을 수 있어서다. 대신 `GET /api/uploads/[name]` Route Handler 가 파일을 읽어 `Content-Type` 과 긴 `Cache-Control` 로 응답한다 (바이너리 응답 예).
- 검증(`uploads-validate.ts`): 타입 4종, 2MB 이하. 순수 함수라 단위 테스트가 있다. 파일명은 정규식으로 검사해 경로 탈출(`../`)을 막는다.
- 표시는 `next/image`. 크기를 모르는 업로드 이미지는 `fill` + 부모의 `relative` 와 `aspect-video` 로 자리를 잡고, `sizes` 로 브라우저가 적절한 해상도를 고르게 한다. 최적화된 결과는 `/_next/image?url=...` 로 내려온다 (Network 탭에서 WebP 로 변환된 것을 볼 수 있다). 목록의 작은 썸네일은 일부러 `<img>` 를 써서 차이를 비교한다.
- 수정 시 새 파일이면 교체(이전 파일 삭제), "현재 이미지 삭제" 체크면 제거, 글 삭제 시 파일도 삭제.

### 2-12. `next/dynamic` 으로 브라우저 전용 컴포넌트 (`recently-viewed*.tsx`)

`localStorage` 로 "최근 본 글" 을 기록하는 위젯. 렌더링 중에 `localStorage` 를 읽으므로 서버에서는 실행할 수 없다.

- `dynamic(() => import("./recently-viewed"), { ssr: false, loading })` 로 감싸면 (1) 서버 HTML 에 포함되지 않고 (2) 별도 JS 청크로 분리되어 (3) hydration 뒤 브라우저에서 로드된다.
- `ssr: false` 는 **클라이언트 컴포넌트 안에서만** 쓸 수 있다. 그래서 `recently-viewed-loader.tsx` 라는 얇은 `"use client"` 래퍼를 두고 서버 컴포넌트(`page.tsx`)는 그 래퍼를 쓴다.
- 언제 쓰나: `window` 에 의존하는 라이브러리(차트, 에디터, 지도), 처음엔 안 보이는 무거운 UI(모달). 그 외에는 서버 컴포넌트가 이미 자동으로 코드 분할하므로 불필요하다.

### 2-13. 무한 스크롤 (`/feed`)

`/posts` 의 번호 페이지네이션과 같은 데이터를 다른 UX 로 보여 준다. 세 가지 조각으로 이루어진다.

| 조각 | 파일 | 역할 |
| --- | --- | --- |
| 커서 조회 | `src/lib/posts.ts` 의 `getPostsByCursor` | "마지막으로 본 id 보다 작은 것 N개". `limit+1` 개를 읽어 다음 페이지 유무를 판단 |
| API | `src/app/api/posts/route.ts` (`?cursor=&limit=`) | `{ posts, nextCursor }` 를 돌려준다. `nextCursor` 가 `null` 이면 끝 |
| 클라이언트 | `src/app/feed/post-feed.tsx` | `useInfiniteQuery` 로 페이지를 쌓고, `IntersectionObserver` 로 끝을 감지 |

**offset 과 cursor 의 차이**: `/posts` 는 `OFFSET (page-1)*5` 로 건너뛰는 방식이라 스크롤 중에 새 글이 추가되면 항목이 밀려 중복이나 누락이 생길 수 있다. 커서 방식은 `id < 마지막 id` 조건이라 그런 문제가 없고, 큰 offset 을 세지 않아 뒤 페이지도 빠르다. 대신 "3페이지로 바로 가기" 는 못 한다.

**첫 페이지는 서버에서**: 서버 컴포넌트가 캐시된 `getPostsPage("", 1)` 로 첫 5개를 렌더링해 `initialData` 로 넘긴다. 정적 셸에 목록이 들어가므로 빈 화면 없이 바로 보이고, 이후 페이지만 브라우저가 가져온다. 이렇게 서버 데이터와 클라이언트 페칭 라이브러리의 캐시를 이어 붙이는 것이 문서의 "Provide initial data from a Server Component" 패턴이다.

**끝 감지**: 목록 아래에 빈 `div`(sentinel) 를 두고 `IntersectionObserver` 로 화면에 들어오는지 본다. `rootMargin: "200px"` 로 끝에 닿기 전에 미리 요청해 끊김을 줄인다. 화면이 커서 스크롤이 안 생기는 경우를 위해 "더 보기" 버튼도 둔다.

**Cache Components 와의 충돌 한 가지**: TanStack Query 는 내부에서 `Date.now()` 를 쓰는데, 빌드 프리렌더 중에 이런 값이 정적 셸에 굳는 것을 Next.js 가 에러로 막는다 (`Route "/feed": Next.js encountered the unstable value Date.now() in a Client Component`). 문서의 처방은 클라이언트 컴포넌트 첫 줄에서 `use(io())` 를 호출하는 것이다. 프리렌더 중에는 suspend 해서 부모 `<Suspense>` 의 fallback 이 셸에 들어가고, 실제 요청과 브라우저에서는 즉시 통과한다. 그래서 `page.tsx` 는 같은 첫 페이지를 정적 `StaticList` 로 fallback 에 그려 두어, 셸에도 목록이 보이게 했다.

TanStack Query 의 `QueryClientProvider` 는 이 페이지와 `/client-fetch` 가 함께 쓰므로 두 페이지가 속한 `(demos)` 그룹의 레이아웃(`src/app/(demos)/layout.tsx`)에 둔다.

### 2-14. 병렬 라우트 + 인터셉팅 라우트: 목록 위의 모달 (`src/app/posts/@modal/`)

목록에서 글을 클릭하면 **모달** 로 열리고, 그 상태에서 새로고침하거나 주소를 공유하면 **전체 페이지** 가 되는 패턴. App Router 고유 기능 두 개를 조합한다.

| 개념 | 폴더 | 역할 |
| --- | --- | --- |
| 병렬 라우트 (슬롯) | `posts/@modal/` | `@폴더` 는 URL 에 안 들어가고, `layout.tsx` 에 `modal` prop 으로 전달된다. `children` 과 나란히 렌더링 |
| 인터셉팅 라우트 | `posts/@modal/(.)[id]/page.tsx` | `(.)` = 같은 레벨. 클라이언트 이동으로 `/posts/3` 에 갈 때 진짜 `posts/[id]` 대신 이 파일이 슬롯에 렌더링된다 |
| 슬롯 기본값 | `posts/@modal/default.tsx` | 인터셉트 대상이 아닐 때(`/posts`, 새로고침) `null`. 없으면 404 |

동작 흐름:
1. `/posts` 에서 `<Link href="/posts/3">` 클릭 → 클라이언트 이동 → 인터셉트 → `@modal` 슬롯에 모달, URL 은 `/posts/3`, 뒤의 목록은 그대로.
2. 닫기(ESC, 바깥 클릭, X) → `router.back()` → URL 이 `/posts` 로 돌아가며 슬롯이 `default`(null) 로 바뀐다. 브라우저 뒤로/앞으로 버튼과도 맞물린다.
3. `/posts/3` 에서 새로고침 → 하드 내비게이션 → 인터셉트 없음 → 원래 `posts/[id]/page.tsx`(댓글, 수정 버튼 포함).
4. 모달 안의 "전체 페이지로 보기" 는 일부러 `<a>` 를 써서 하드 내비게이션으로 원래 페이지를 연다.
5. 모달이 열리면 뒤의 목록은 접근성 트리에서 숨겨진다(`inert`). 화면에는 보이지만 스크린리더와 `getByRole` 은 무시한다. 테스트에서 CSS 셀렉터로 찾는 이유다.

`@modal` 은 슬롯이라 세그먼트로 세지 않으므로 `posts/@modal/(.)[id]` 가 `posts/[id]` 를 가리킨다. 파일 시스템 깊이가 아니라 "라우트 세그먼트" 기준이다.

**직접 부딪힌 함정**: 인터셉터 `(.)[id]` 는 클라이언트 이동으로 `/posts/<무엇이든>` 에 가면 전부 가로챈다. 원래 `/posts/feed`, `/posts/client`, `/posts/releases` 에 있던 정적 페이지들이 `[id]="feed"` 로 잡혀 "글을 찾을 수 없습니다" 모달이 떠 버렸다 (E2E 가 잡아냈다). 서버 라우팅에서는 정적 라우트가 동적보다 우선하지만, 인터셉트 판단은 URL 패턴으로 이루어지기 때문이다. 해결은 구조 변경: 그 페이지들을 `src/app/(demos)/` 라우트 그룹으로 옮겨 `/feed`, `/client-fetch`, `/releases` 로 만들고, 옛 URL 은 `next.config.ts` 의 `redirects` 로 308 리다이렉트했다. **동적 세그먼트를 인터셉트하는 슬롯 옆에는 정적 형제 라우트를 두지 말 것.** `e2e/routing.spec.ts` 의 마지막 테스트가 이 회귀를 감시한다.

### 2-15. `template.tsx` (`src/app/(demos)/template.tsx`)

`layout.tsx` 와 같은 자리에서 페이지를 감싸지만, **그 레벨의 세그먼트가 바뀔 때마다 새로 마운트** 된다. `(demos)` 그룹의 layout 은 `/releases` → `/feed` 로 옮겨도 그대로 유지되어 네비게이션이 깜빡이지 않는 반면, template 은 자식 세그먼트(releases → feed)가 바뀌었으므로 새 key 로 만들어진다. 깊은 세그먼트만 바뀌는 이동(예: `/posts` → `/posts/3/edit` 에서 `posts` 레벨 template)은 상위 template 을 재마운트하지 않는다.

- 그래서 template 의 진입 애니메이션(`animate-in fade-in`)은 이동할 때마다 재생되고, 그 안의 클라이언트 state 와 `useEffect` 는 초기화된다.
- 렌더링 순서: `layout > template > error > loading > not-found > page`.
- template 은 `children` 뿐 아니라 같은 레벨의 **슬롯(`@modal` 등)도 각각** 감싼다. 슬롯이 있는 레이아웃에 template 을 두면 같은 template 이 여러 개 렌더링된다.
- 쓰는 곳: 페이지 진입 효과, 이동마다 리셋돼야 하는 입력 상태, 이동마다 다시 실행해야 하는 효과(페이지뷰 로깅). 대부분의 경우에는 layout 이 맞다.
- E2E(`e2e/routing.spec.ts`)는 DOM 노드에 표식을 남긴 뒤 이동해서, 새 노드로 바뀌었는지로 재마운트를 확인한다.
- 여기서 Cache Components 의 특성 하나가 드러난다: 이동한 뒤에도 **이전 라우트의 DOM 이 `<Activity mode="hidden">` 으로 숨겨진 채 남아 있다** (뒤로 가기 때 상태 그대로 복원하기 위해). 그래서 표식이 남은 옛 template 노드가 숨겨진 채 존재하고, 화면에 보이는 것은 새로 마운트된 노드다. 테스트에서 "보이는 노드" 를 골라야 하는 이유다.

### 2-16. 리다이렉트 (`next.config.ts`, `src/app/p/[id]/page.tsx`)

| 방법 | 어디서 | 상태 코드 | 이 프로젝트 |
| --- | --- | --- | --- |
| `redirects()` in `next.config.ts` | 경로 패턴만으로 정해질 때. 라우트보다 먼저 검사 | 308(`permanent: true`) / 307 | `/blog/:id` → `/posts/:id`, `/articles` → `/posts`, 옮긴 데모 페이지 `/posts/feed` → `/feed` 등, 임시 `/latest` → `/feed` |
| `redirect()` | 서버 컴포넌트, Server Action, Route Handler. 조건이 코드에 있을 때 | 307 (Server Action 에서는 303) | 글 작성 후 상세로, 로그인 필요 시 `/login` 으로 |
| `permanentRedirect()` | 위와 같되 "영구" 로 알릴 때 (URL 체계 변경 등) | 308 | `/p/3` → `/posts/3` (DB 확인 후) |
| `NextResponse.redirect` in `proxy.ts` | 요청 전 단계, 쿠키/헤더 조건 | 임의 | 비로그인 → `/login` |
| `router.push()` | 클라이언트 이벤트 핸들러 | 없음 (클라이언트 이동) | 모달 닫기의 `router.back()` |

- 307/308 의 차이: 브라우저와 검색엔진이 308 은 영구 기억한다. 되돌릴 가능성이 있으면 307.
- `redirects` 는 쿼리스트링을 목적지로 그대로 넘긴다 (`/articles?page=2` → `/posts?page=2`).
- `redirect()`/`permanentRedirect()` 는 **예외를 던지는** 방식이라 그 아래 코드는 실행되지 않고, `try/catch` 로 감싸면 삼켜진다.
- **상태 코드가 진짜로 나가려면 스트리밍 전에 리다이렉트해야 한다.** `<Suspense>` 안에서 리다이렉트하면 이미 정적 셸(200)이 전송된 뒤라서 HTTP 308 이 아니라 스트림 속 "클라이언트 리다이렉트 지시" 가 된다. 브라우저는 이동하지만 curl 이나 검색엔진은 200 을 본다. 그래서 `src/app/p/[id]/page.tsx` 는 일부러 Suspense 없이 페이지 최상위에서 `params` 를 읽고 리다이렉트한다. 정적 셸을 포기하는 대신 실제 308/404 를 얻는다. 글 수정 페이지의 "남의 글 → 상세로" 는 반대로 Suspense 안이라 200 + 클라이언트 리다이렉트다. 둘의 차이를 `curl -I` 로 비교해 보자.

---

## Part 3. 인증과 권한, 댓글

라이브러리 없이 공식 문서의 방식대로 직접 구현했다. 문서는 인증을 세 개념으로 나눈다.

| 개념 | 하는 일 | 파일 |
| --- | --- | --- |
| 인증 (Authentication) | 본인 확인. 회원 가입, 로그인 | `src/app/(auth)/actions.ts`, `src/lib/password.ts`, `src/lib/users.ts` |
| 세션 (Session) | 로그인 상태를 요청 간에 유지 | `src/lib/session.ts` |
| 인가 (Authorization) | 누가 무엇을 할 수 있는지 | `src/lib/dal.ts`, 각 Server Action, `src/proxy.ts` |

### 3-1. 회원 가입과 로그인 (`src/app/(auth)/`)

- `(auth)` 는 **라우트 그룹**. 괄호 폴더는 URL 에 안 들어가서 `/login`, `/signup` 이 되고, 두 페이지가 `layout.tsx` 를 공유한다.
- 가입 흐름: Zod 검증 → 이메일 중복 확인 → 비밀번호 **해시** → DB 저장 → 세션 쿠키 발급 → `redirect`.
- 비밀번호는 `crypto.scrypt` 로 해시한다 (`src/lib/password.ts`). 사용자마다 다른 salt 를 붙여 같은 비밀번호도 다른 해시가 되고, 비교는 `timingSafeEqual` 로 해서 응답 시간으로 정보가 새지 않게 한다. 문서 예제는 bcrypt 를 쓰는데 원리는 같다.
- 로그인 실패 메시지는 "이메일 또는 비밀번호가 올바르지 않습니다" 하나로 통일한다. 이메일 존재 여부를 알려 주면 계정 탐색에 쓰일 수 있다.

### 3-2. 세션: 서명된 JWT 쿠키 (`src/lib/session.ts`)

문서가 말하는 두 방식 중 **stateless** 방식이다. 세션을 DB 에 저장하지 않고, `{ userId }` 를 `SESSION_SECRET` 으로 서명한 JWT 를 쿠키에 넣는다.

- 브라우저가 쿠키 내용을 바꾸면 서명 검증에 실패한다. 서명 키는 서버만 안다.
- 쿠키 옵션: `httpOnly`(JS 로 못 읽음), `sameSite: lax`(CSRF 완화), `secure`(프로덕션에서 https 만), 7일 만료.
- 쿠키는 반드시 **서버에서** 설정한다. Server Action 안에서 `cookies().set()` 을 호출한다.
- JWT 안에는 id 정도만 넣는다. 이메일, 비밀번호 같은 것은 넣지 않는다.

### 3-3. 인가: DAL 과 Server Action

문서가 가장 강조하는 원칙은 **"권한 검사는 데이터에 가장 가까운 곳에서"** 다.

- `src/lib/dal.ts` 의 `getCurrentUser()` 가 쿠키 → 세션 → 사용자 조회를 한 곳에서 한다. React `cache()` 로 감싸서 한 렌더링 안에서 여러 번 불려도 한 번만 실행된다.
- 모든 Server Action 이 첫 줄에서 세션을 **다시 읽고** 검사한다 (`src/app/posts/actions.ts`). 화면에서 버튼을 숨기는 것은 편의일 뿐이다. Server Action 은 브라우저에서 직접 POST 로 호출할 수 있으므로 공개 API 와 같은 수준으로 방어해야 한다.
- 규칙: 글 작성·댓글 작성은 로그인 필요, 글 수정·삭제·댓글 삭제는 **작성자 본인만**. demo 계정으로 게스트의 글(#6)을 열어 보면 수정 버튼이 없고, URL 로 `/posts/6/edit` 에 직접 들어가도 상세로 돌려보낸다.
- `src/proxy.ts` 는 요청이 라우트에 닿기 전에 쿠키만 보고 낙관적으로 리다이렉트한다 (비로그인 → `/login`, 로그인 상태에서 `/login` → `/posts`). 문서가 "보조 수단이지 보안 경계가 아니다" 라고 못 박는 부분이다. DB 조회는 하지 않는다.

### 3-4. Cache Components 에서 세션 다루기

세션은 요청 시점 데이터라 정적 셸에 들어갈 수 없다. 그래서 세션을 읽는 컴포넌트는 **항상 `<Suspense>` 안에** 둔다. 이 프로젝트에서 그 경계가 어디에 있는지 보면 패턴이 잡힌다.

| 위치 | 캐시/정적 부분 | Suspense 안 (요청 시 스트리밍) |
| --- | --- | --- |
| `src/app/layout.tsx` | 헤더 링크 | `<UserMenu />` 로그인 상태 |
| `src/app/posts/page.tsx` | 글 목록 (`"use cache"`) | 새 글 폼 (로그인 여부) |
| `src/app/posts/[id]/page.tsx` | 글 본문 (`"use cache"`) | 수정/삭제 버튼, 댓글 영역 |

레이아웃 최상위에서 세션을 `await` 하면 모든 페이지가 그걸 기다리게 되므로, 반드시 컴포넌트 안으로 밀어 넣어야 한다. 빌드 결과에서 모든 페이지가 `◐ Partial Prerender` 로 바뀐 이유가 헤더의 `<UserMenu />` 다.

캐시된 데이터(댓글 목록)와 요청별 데이터(현재 사용자)를 합치는 방법은 `comments-section.tsx` 에 있다. 캐시된 목록은 모두가 공유하므로 "누가 삭제할 수 있는지" 를 캐시 안에서 판단하면 안 되고, 화면을 그릴 때 현재 사용자와 `authorId` 를 비교한다.

### 3-5. 2단 댓글 (`src/lib/comments.ts`)

- 테이블 하나로 표현한다. `parent_id` 가 NULL 이면 최상위 댓글, 값이 있으면 그 댓글의 답글.
- 조회는 쿼리 한 번으로 평탄한 목록을 가져와 서버에서 트리로 조립한다 (`getCommentThreads`).
- **2단 제한** 은 액션에서 검사한다: 부모가 같은 글의 최상위 댓글일 때만 답글을 허용한다.
- 최상위 댓글을 지우면 답글도 함께 지워진다. `ON DELETE CASCADE` 와 `PRAGMA foreign_keys = ON` 이 그 역할을 한다. 글을 지우면 댓글 전체가 같이 지워지는 것도 같은 원리.
- 댓글 목록은 글마다 다른 태그(`post-3-comments`)로 캐시된다. 댓글을 쓰면 그 글의 태그만 무효화되고 다른 글의 캐시는 그대로다.

### 3-6. 스키마 변경을 직접 관리하기 (`src/lib/schema.ts`)

인증을 붙이면서 `posts` 에 `author_id` 컬럼이 추가됐다. `CREATE TABLE IF NOT EXISTS` 는 이미 있는 테이블을 건드리지 않으므로, `ensureSchema()` 가 `PRAGMA table_info` 로 컬럼을 확인하고 없으면 `ALTER TABLE` 로 추가한다. Prisma 나 Drizzle 의 마이그레이션이 자동으로 해 주는 일을 손으로 한 것이다. 스키마 정의를 앱과 스크립트가 공유하도록 이 파일 하나에 모았다.

---

## Part 4. 테스트

공식 문서(Testing 가이드)가 제시하는 조합을 그대로 썼다.

| 종류 | 도구 | 대상 | 실행 |
| --- | --- | --- | --- |
| 단위 (Unit) | Vitest | 순수 함수: 비밀번호 해시, Zod 스키마, 세션 | `npm test` |
| 통합 (Integration) | Vitest + 실제 SQLite(임시 파일) | 데이터 접근 함수, Route Handler | `npm test` |
| 컴포넌트 (Component) | Vitest + React Testing Library + jsdom | 클라이언트 컴포넌트의 렌더링과 상호작용 | `npm test` |
| E2E | Playwright + 시스템 Chrome | 실제 브라우저에서 사용자 흐름 전체 | `npm run test:e2e` |

### 4-1. 무엇을 어디서 테스트하나

공식 문서의 핵심 주의 사항: **async 서버 컴포넌트는 단위 테스트 도구가 지원하지 않는다.** 그래서 이 프로젝트에서는 층에 따라 도구를 나눈다.

| 코드 | 방법 | 이유 |
| --- | --- | --- |
| `src/lib/password.ts`, `src/lib/schemas/*` | 단위 테스트 | 외부 의존성이 없는 순수 함수. 가장 빠르고 쉽다 |
| `src/lib/session.ts` | 단위 테스트 + `next/headers` mock | `cookies()` 는 실제 요청이 있어야 동작하므로 가짜로 바꾼다 |
| `src/lib/posts.ts`, `comments.ts` | 통합 테스트 (임시 SQLite) | SQL 이 실제로 맞는지, CASCADE 가 동작하는지는 진짜 DB 로 봐야 한다 |
| `src/app/api/posts/route.ts` | 통합 테스트 | Route Handler 는 `(Request) => Response` 함수라 서버 없이 직접 호출할 수 있다 |
| `src/app/api/v1/**/route.ts` | 통합 테스트 | 같은 이유. 인증·권한·상태 코드를 서버 없이 검증한다 (`src/test/api-request.ts` 헬퍼) |
| `src/lib/api/rate-limit.ts` | 단위 테스트 | `now` 를 인자로 받게 만들어 두면 시계를 조작하지 않고 창 만료를 테스트할 수 있다 |
| `post-form.tsx`, `todo-item.tsx` | 컴포넌트 테스트 | 클라이언트 컴포넌트. Server Action 은 props 나 `vi.mock` 으로 가짜를 넣는다 |
| `page.tsx` (async 서버 컴포넌트), Server Action, `loading/error/not-found`, 스트리밍, 캐시 | **E2E** | 단위 도구로는 실행할 수 없거나, 실제 서버가 있어야 의미가 있다 |

### 4-2. Vitest 설정 (`vitest.config.mts`, `src/test/`)

- `environment: "jsdom"` 이 기본. DOM 이 필요 없는 파일은 맨 위에 `// @vitest-environment node` 를 적는다. 더 빠르고, `jose` 처럼 Web Crypto 를 쓰는 코드는 jsdom 의 `Uint8Array` 와 호환되지 않아 node 환경이 필요하다.
- `server-only` 패키지는 alias 로 빈 모듈(`src/test/server-only.ts`)로 바꿔치기한다. 테스트는 Node 에서 돌기 때문이다.
- `src/test/setup.ts` 가 테스트 파일마다 실행되어 (1) `DATABASE_PATH` 를 임시 파일로 바꾸고 (2) 테스트용 `SESSION_SECRET` 을 넣고 (3) jest-dom matcher 를 등록하고 (4) 렌더링한 DOM 을 테스트마다 정리한다. **개발 DB(data/app.db)는 절대 건드리지 않는다.**

### 4-3. Next.js 에 묶인 코드를 mock 하는 법

테스트 파일에서 자주 쓰는 패턴 세 가지. 각각 해당 테스트 파일에 주석으로 설명이 있다.

| 상황 | 방법 | 예 |
| --- | --- | --- |
| `cookies()` 등 요청 API | `vi.mock("next/headers", ...)` 로 메모리 저장소를 흉내 | `src/lib/session.test.ts` |
| `"use cache"` 안의 `cacheLife`, `cacheTag` | `vi.mock("next/cache", ...)` 로 no-op | `src/lib/posts.test.ts`, `comments.test.ts` |
| Route Handler 의 `revalidateTag`, `revalidatePath` | 같은 `vi.mock("next/cache", ...)` 에 함께 넣는다 | `src/app/api/v1/**/*.test.ts` |
| 클라이언트 컴포넌트가 import 한 Server Action | `vi.mock("./actions", ...)` 로 호출 여부만 검사 | `src/app/todos/todo-item.test.tsx` |
| 액션을 props 로 받는 컴포넌트 | 가짜 액션 함수를 그냥 넘긴다 (mock 불필요) | `src/app/posts/post-form.test.tsx` |

`vi.mock` 은 파일 맨 위로 끌어올려지므로(호이스팅), 테스트 대상은 `await import()` 로 그 뒤에 불러오는 것이 안전하다.

### 4-4. Playwright E2E (`playwright.config.ts`, `e2e/`)

공식 문서 권장대로 **프로덕션 빌드** 를 대상으로 한다. `webServer` 설정이 아래를 자동으로 수행한다.

1. `DATABASE_PATH=data/e2e.db` 로 E2E 전용 DB 를 샘플 데이터로 초기화 (`db:seed -- --reset`)
2. `npm run build` → `npm run start -- -p 3100`
3. 서버가 응답하면 테스트 시작, 끝나면 서버 종료

개발 서버(3000)나 개발 DB 와 분리되어 있어 언제 돌려도 안전하다. 처음 실행은 빌드 때문에 1분 정도 걸린다.

| 파일 | 내용 |
| --- | --- |
| `e2e/rendering.spec.ts` | 캐시 시각이 새로고침 후에도 같은지(ISR), updateTag 로 바뀌는지, 스트리밍 영역이 나중에 채워지는지, not-found / error.tsx, SWR 검색이 API 를 호출하는지 |
| `e2e/routing.spec.ts` | 모달 열기/닫기/새로고침, template 재마운트, 리다이렉트 상태 코드 |
| `e2e/auth-posts-comments.spec.ts` | 가입(검증 실패→성공) → 글 작성/수정 → 댓글/답글 → 게스트로 권한 확인 → 로그인 실패/로그아웃 → 글 삭제. `test.describe.serial` 로 순서를 보장한다 |
| `e2e/public-api.spec.ts` | 공개 API: OpenAPI 명세, CORS 프리플라이트, 토큰·API 키 흐름, API 로 쓴 글이 웹 화면에 반영되는지, 세션 쿠키가 거부되는지. 단위 테스트는 proxy 를 거치지 않으므로 이런 것은 E2E 로만 확인된다 |

브라우저는 시스템에 설치된 Chrome 을 쓴다 (`channel: "chrome"`). 없으면 `npx playwright install chromium` 을 실행하고 설정에서 `channel` 줄을 지운다.

유용한 명령:

```bash
npx playwright test --ui            # 브라우저 UI 로 단계별 실행
npx playwright test --headed        # 실제 창을 띄워서 실행
npx playwright show-trace test-results/<폴더>/trace.zip   # 실패한 테스트 재생
```

### 4-5. 테스트를 쓸 때 배운 것

- **셀렉터는 역할(role)로.** shadcn `Button` 을 `render={<Link/>}` 로 링크처럼 써도 role 은 `button` 이다. `getByRole("button", { name: "수정" })` 로 찾아야 한다.
- **헤더의 로그아웃도 submit 버튼이다.** `button[type=submit]` 처럼 넓게 잡으면 엉뚱한 버튼을 누른다. `form` 범위를 먼저 좁힌다.
- **Server Action 은 브라우저에서만 검증할 수 있다.** curl 로 GET 응답을 확인하는 것으로는 폼 제출이 되는지 알 수 없다. 그래서 E2E 가 필요하다.
- **테스트 DB 는 반드시 분리한다.** 단위 테스트는 임시 파일, E2E 는 `data/e2e.db`.

---

## Part 5. 공개 API (`/api/v1`) — 외부 개발자에게 열어 주기

지금까지의 Route Handler(`/api/todos`, `/api/posts`)는 **이 앱의 화면이 쓰는 내부용**이었다.
Part 5 는 같은 데이터를 **남이 쓸 수 있는 형태**로 여는 것을 다룬다. 둘의 차이가 이 파트의 핵심이다.

| | 내부용 (`/api/posts`) | 공개용 (`/api/v1/posts`) |
| --- | --- | --- |
| 사용자 | 우리 화면의 SWR / TanStack Query | 남의 서버, 남의 앱, curl |
| 인증 | 필요 없음 (같은 출처) | `Authorization: Bearer` |
| 응답 모양 | 화면에 맞춰 자유롭게 | 봉투(`data` / `error`) 고정 |
| 바꿔도 되나 | 언제든 (같이 고치면 됨) | 못 바꾼다. 남의 코드가 깨진다 → `/v1` |
| 문서 | 주석 | OpenAPI + README |

그래서 기존 `/api/posts`, `/api/todos` 는 **그대로 두고** `/api/v1` 아래에 따로 만들었다.
버전을 경로에 박아 두면 나중에 응답 모양을 바꿔야 할 때 `/api/v2` 를 새로 열고 둘을 함께 운영할 수 있다.

### 5-1. 터미널로 따라 하기 (복사해서 붙여 넣기)

`jq` 가 설치되어 있으면 응답을 보기 좋게 볼 수 있다 (`sudo apt install jq`). 없으면 각 명령 끝의 `| jq ...` 를 빼면 된다.
먼저 개발 서버를 띄우고(`npm run dev`), 터미널에 찍힌 포트를 아래 변수에 넣는다. 이 변수는 이후 모든 단계에서 쓴다.

```bash
B=http://localhost:3000   # npm run dev 가 3001 등 다른 포트에 떴으면 그 포트로
```

#### 1. 어떤 엔드포인트가 있는지 보기 (인증 불필요)

```bash
curl -s $B/api/v1 | jq
```

`endpoints` 에 auth, posts, comments, todos 가, `rateLimit` 에 분당 한도가 보인다.

#### 2. 로그인해서 액세스 토큰 받기 (시드 계정, 1시간 유효)

```bash
TOKEN=$(curl -s -X POST $B/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"password123"}' | jq -r .data.accessToken)
echo $TOKEN
```

긴 JWT 문자열이 출력되면 성공. 비어 있으면 서버 주소나 시드(`npm run db:seed`)를 확인한다.

#### 3. 토큰이 잘 전달되는지 확인

```bash
curl -s $B/api/v1/auth/me -H "Authorization: Bearer $TOKEN" | jq
```

`data.user` 에 데모 계정이, `via` 에 `access_token` 이 나온다.

#### 4. 글 목록 읽기 (읽기는 토큰 없이 된다)

```bash
curl -s "$B/api/v1/posts?limit=2" | jq
curl -s "$B/api/v1/posts?q=스트리밍" | jq '.data[] | {id, title}'
```

`data` 배열과 `pagination`(total, limit, offset, hasMore) 이 함께 온다. `author` 는 `{ id, name }` 객체.

#### 5. 글 작성 (토큰 필요)

```bash
NEW=$(curl -s -X POST $B/api/v1/posts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"API 로 쓴 글","content":"터미널에서 작성"}')
echo $NEW | jq
ID=$(echo $NEW | jq -r .data.id)   # 이후 단계에서 쓴다
```

브라우저에서 `/posts` 를 새로고침하면 방금 쓴 글이 보인다 (`updateTag` 로 목록 캐시가 갱신됐기 때문).

#### 6. 실패 응답 모양 보기

```bash
# 토큰 없이 → 401 unauthorized
curl -s -X POST $B/api/v1/posts -H 'Content-Type: application/json' \
  -d '{"title":"x","content":"y"}' | jq

# 제목을 비우고 내용을 빼면 → 422 validation_failed, details 에 필드별 메시지
curl -s -X POST $B/api/v1/posts -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":""}' | jq
```

#### 7. 글 수정 (PATCH, 바꿀 필드만 보낸다)

```bash
curl -s -X PATCH $B/api/v1/posts/$ID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"API 로 수정한 글"}' | jq
```

#### 8. 권한 검사 확인 (남의 글은 403)

```bash
GT=$(curl -s -X POST $B/api/v1/auth/token -H 'Content-Type: application/json' \
  -d '{"email":"guest@example.com","password":"password123"}' | jq -r .data.accessToken)

curl -s -X PATCH $B/api/v1/posts/$ID -H "Authorization: Bearer $GT" \
  -H 'Content-Type: application/json' -d '{"title":"남의 글"}' | jq   # forbidden
```

#### 9. 댓글 달기와 읽기

```bash
# 게스트 토큰으로 댓글 (댓글은 로그인만 하면 누구나)
curl -s -X POST $B/api/v1/posts/$ID/comments \
  -H "Authorization: Bearer $GT" -H 'Content-Type: application/json' \
  -d '{"content":"API 댓글"}' | jq

# 답글은 parentId 를 추가한다
CID=$(curl -s $B/api/v1/posts/$ID/comments | jq -r '.data[0].id')
curl -s -X POST $B/api/v1/posts/$ID/comments \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"content\":\"API 답글\",\"parentId\":$CID}" | jq

curl -s $B/api/v1/posts/$ID/comments | jq
```

#### 10. 오래 쓸 API 키 발급 (봇·서버 간 호출용, 만료 없음)

```bash
KEY=$(curl -s -X POST $B/api/v1/auth/keys \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"내 봇"}' | tee /dev/stderr | jq -r .data.key)
```

`key` 값은 **이 응답에서만** 볼 수 있다. 서버에는 SHA-256 해시만 남는다. 키로도 토큰과 똑같이 호출된다.

```bash
curl -s $B/api/v1/auth/me -H "Authorization: Bearer $KEY" | jq      # via 가 api_key
curl -s $B/api/v1/auth/keys -H "Authorization: Bearer $TOKEN" | jq  # 내 키 목록 (prefix 만 보인다)
```

#### 11. API 키 폐기 (즉시 401)

```bash
KID=$(curl -s $B/api/v1/auth/keys -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $B/api/v1/auth/keys/$KID \
  -H "Authorization: Bearer $TOKEN"                                  # 204
curl -s $B/api/v1/auth/me -H "Authorization: Bearer $KEY" | jq      # unauthorized
```

#### 12. 글 삭제 (작성자만, 댓글도 CASCADE 로 함께 삭제)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $B/api/v1/posts/$ID \
  -H "Authorization: Bearer $TOKEN"                                  # 204
curl -s $B/api/v1/posts/$ID | jq                                    # not_found
```

#### 응답 헤더 보는 법 (모든 단계에 적용)

위 명령들은 본문(JSON)만 보여 준다. 상태 코드, `Content-Type`, `X-RateLimit-*` 같은 헤더까지 보려면 curl 옵션을 더한다.

```bash
# 헤더만: -D - 로 헤더를 화면에 쓰고, -o /dev/null 로 본문은 버린다
curl -s -D - -o /dev/null "$B/api/v1/posts?limit=2"

# 헤더 + 본문을 한 번에 (단, 이 상태로 | jq 를 붙이면 헤더 때문에 파싱이 깨진다)
curl -s -i "$B/api/v1/posts?limit=2"

# 헤더는 stderr 로, 본문만 jq 로 → 화면에는 둘 다 보이고 jq 도 정상 동작
curl -s -D /dev/stderr "$B/api/v1/posts?q=스트리밍" | jq '.data[] | {id, title}'

# 보낸 요청(>)과 받은 응답(<) 헤더 전부. Authorization 이 제대로 붙었는지 볼 때
curl -s -v -H "Authorization: Bearer $TOKEN" $B/api/v1/auth/me 2>&1 | grep "^[<>]"

# 특정 헤더만 골라서
curl -s -D - -o /dev/null "$B/api/v1/posts?limit=2" | grep -i "ratelimit\|content-type\|cache-control"

# 추천 조합: 헤더와 상태 줄은 stderr, 본문만 jq 로.
# -w 출력은 기본적으로 stdout(본문 뒤)에 붙어 jq 를 깨뜨리므로 %{stderr} 로 stderr 로 보낸다
curl -s -w "%{stderr}--- status: %{http_code}  time: %{time_total}s\n" -D /dev/stderr "$B/api/v1/posts?limit=2" | jq
```

`-I` 는 HEAD 요청을 보내므로 GET 과 응답이 다를 수 있다. 헤더만 볼 때도 `-D - -o /dev/null` 쪽이 안전하다.

#### 요청 헤더 보는 법 (내가 무엇을 보냈는지 확인)

401 이나 415 가 날 때는 "서버가 뭘 돌려줬나" 보다 "내가 뭘 보냈나" 를 먼저 봐야 한다. curl 이 실제로 보낸 요청은 `-v` 로 볼 수 있다.
보낸 요청은 `>`, 받은 응답은 `<` 로 시작하고, 이 출력은 stderr 로 나가므로 `2>&1` 로 합쳐야 grep 이 된다.

```bash
# 보낸 요청 헤더만
curl -s -v -H "Authorization: Bearer $TOKEN" $B/api/v1/auth/me 2>&1 | grep "^>"

# 보낸 것(>)과 받은 것(<) 모두
curl -s -v -H "Authorization: Bearer $TOKEN" $B/api/v1/auth/me 2>&1 | grep "^[<>]"

# 요청 본문(JSON)까지 확인해야 할 때: -v 는 본문을 안 보여 주므로 --trace-ascii 를 쓴다
curl -s --trace-ascii /dev/stderr -X POST $B/api/v1/posts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"t","content":"c"}' 2>&1 >/dev/null | grep -A2 "Send header\|Send data"
```

`-v` 출력에서 확인할 것:

| 보이는 것 | 뜻 |
| --- | --- |
| `> Authorization: Bearer eyJ...` | 토큰이 정상적으로 붙었다 |
| `> Authorization: Bearer` (뒤가 빔) | `$TOKEN` 변수가 비어 있다 → 2번 단계를 다시 실행 |
| `> Authorization: Bearer null` | 토큰 발급이 실패했는데 `jq -r` 이 null 을 문자열로 넣었다 → 발급 응답의 `error` 를 확인 |
| `> Content-Type: application/json` 이 없음 | `-H` 를 빼먹었다. 우리 API 는 415 `unsupported_media_type` 을 돌려준다 |
| 헤더는 정상인데 401 | 발급 후 1시간이 지나 토큰이 만료됐다 → 다시 발급 |

`Host`, `User-Agent`, `Accept` 는 curl 이 기본으로 붙이는 것이라 신경 쓰지 않아도 된다.

**`-v` 는 어디에 넣나, `| jq` 와 같이 써도 되나**: 옵션이라 위치는 상관없고 보통 `-s` 옆에 둔다. `-v` 출력은 stderr 로 가므로
`| jq` 는 그대로 동작한다. `-v` 가 응답 헤더(`<`)까지 보여 주므로 `-D /dev/stderr` 는 같이 쓰지 않는다 (두 번 찍힌다).

```bash
curl -s -v $B/api/v1/openapi.json | jq '.info, (.paths | keys)'
```

GET 은 요청 바디가 없으니 `>` 줄에는 헤더만 보인다. **요청 바디는 `-v` 로도 안 보인다.** `-d` 로 데이터를 보내는 POST/PATCH 에서
바디까지 확인하려면 `--trace-ascii /dev/stderr` 를 쓴다. 요청 헤더, 보낸 바디(`Send data`), 응답 헤더, 받은 바디가 전부 stderr 에 찍히고
stdout 에는 응답 본문만 남아 `| jq` 가 정상 동작한다.

```bash
curl -s --trace-ascii /dev/stderr -X POST $B/api/v1/posts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"t","content":"c"}' | jq
```

| 상황 | 옵션 |
| --- | --- |
| GET, 요청 헤더만 확인 | `-v` |
| POST/PATCH, 보낸 바디까지 확인 | `--trace-ascii /dev/stderr` |
| 응답 헤더만 (요청은 관심 없음) | `-D /dev/stderr` (jq 와 함께) 또는 `-D - -o /dev/null` (본문 버림) |

서버가 **실제로 받은** 헤더를 보고 싶으면(프록시를 거치면 달라질 수 있다) `src/lib/api/route.ts` 의 래퍼 안에
`console.log(Object.fromEntries(request.headers))` 를 임시로 넣으면 `npm run dev` 터미널에 찍힌다. 확인 후에는 지운다.

#### 13. 레이트 리밋 헤더와 OpenAPI 명세

```bash
curl -s -D - -o /dev/null "$B/api/v1/posts?limit=1" | grep -i ratelimit   # 분당 60회, 남은 횟수
curl -s $B/api/v1/openapi.json | jq '.info, (.paths | keys)'
```

기계가 읽는 명세는 `GET /api/v1/openapi.json` (OpenAPI 3.1) 에 있다. 그대로 Swagger UI / Postman 에 넣으면 된다.

```bash
npx @redocly/cli preview-docs http://localhost:3000/api/v1/openapi.json
```

### 5-2. 엔드포인트

읽기(GET)는 공개, 쓰기는 인증 필요가 기본 규칙이다. 수정·삭제는 **작성자 본인만** 할 수 있다.

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/v1` | — | 진입점. 엔드포인트 목록 |
| GET | `/api/v1/openapi.json` | — | OpenAPI 3.1 명세 |
| POST | `/api/v1/auth/register` | — | 가입. 토큰까지 함께 발급 |
| POST | `/api/v1/auth/token` | — | 로그인 → 액세스 토큰 (1시간) |
| GET | `/api/v1/auth/me` | 토큰·키 | 토큰 주인 확인 |
| GET | `/api/v1/auth/keys` | 토큰만 | 내 API 키 목록 |
| POST | `/api/v1/auth/keys` | 토큰만 | API 키 발급 |
| DELETE | `/api/v1/auth/keys/:id` | 토큰만 | API 키 폐기 |
| GET | `/api/v1/posts` | — | 목록. `?q=&limit=&offset=` |
| POST | `/api/v1/posts` | 필요 | 작성 |
| GET | `/api/v1/posts/:id` | — | 한 건 |
| PATCH | `/api/v1/posts/:id` | 작성자 | 부분 수정 |
| DELETE | `/api/v1/posts/:id` | 작성자 | 삭제 (댓글도 CASCADE) |
| GET | `/api/v1/posts/:id/comments` | — | 댓글 목록 |
| POST | `/api/v1/posts/:id/comments` | 필요 | 댓글/답글 (`parentId`) |
| DELETE | `/api/v1/comments/:id` | 작성자 | 댓글 삭제 |
| GET | `/api/v1/todos` | — | 목록. `?completed=true` |
| POST | `/api/v1/todos` | 필요 | 추가 |
| GET/PATCH/DELETE | `/api/v1/todos/:id` | 조회 외 필요 | 한 건 / 수정 / 삭제 |

`todos` 에는 작성자 컬럼이 없어서(모두가 공유하는 하나의 목록) 소유권 검사가 없고 로그인 여부만 본다.
`posts` 와 나란히 놓고 보면 **스키마에 소유자가 있느냐가 권한 설계를 어떻게 바꾸는지** 보인다.

### 5-3. 응답 봉투 (`src/lib/api/http.ts`)

외부 API 에서 가장 중요한 건 일관성이다. 어떤 엔드포인트를 부르든 모양이 같아야 클라이언트가 처리를 한 번만 짜면 된다.

```jsonc
// 단건
{ "data": { "id": 7, "title": "..." } }

// 목록
{ "data": [ ... ], "pagination": { "total": 12, "limit": 20, "offset": 0, "hasMore": true } }

// 실패
{ "error": { "code": "validation_failed", "message": "입력값이 올바르지 않습니다.",
             "details": { "title": ["제목을 입력하세요."] } } }
```

`code` 는 **기계가 분기할 고정 문자열**, `message` 는 사람이 읽는 설명이다.
HTTP 상태 코드만으로는 "왜 400 인지" 를 구분할 수 없어서 둘 다 준다.

| code | 상태 | 언제 |
| --- | --- | --- |
| `bad_request` | 400 | JSON 이 깨졌거나 id 가 숫자가 아님 |
| `unauthorized` | 401 | 토큰이 없거나 유효하지 않음 |
| `forbidden` | 403 | 남의 글을 수정하려 함 |
| `not_found` | 404 | 없는 리소스 |
| `conflict` | 409 | 이미 가입된 이메일 |
| `unsupported_media_type` | 415 | `Content-Type` 이 JSON 이 아님 |
| `validation_failed` | 422 | 값이 규칙에 안 맞음 (`details` 에 필드별 메시지) |
| `rate_limited` | 429 | 한도 초과 (`Retry-After` 헤더) |
| `internal_error` | 500 | 예상 못 한 예외 |

검증 실패에 **400 이 아니라 422** 를 쓴다. "요청 형식은 맞는데 값이 규칙에 안 맞다" 를 구분해 주면
클라이언트가 "내 코드가 잘못 보냈나(400)" 와 "사용자 입력이 틀렸나(422)" 를 나눠 처리할 수 있다.

에러는 `throw` 하고 래퍼가 받아 준다. 덕분에 핸들러 본문에는 성공 경로만 남는다.

```ts
// src/app/api/v1/posts/[id]/route.ts
export const PATCH = apiRoute<{ id: string }>(async ({ request, params, auth }) => {
  const { user } = requireAuth(auth);                       // 없으면 401
  const post = loadPost(params.id);                          // 없으면 404
  if (post.authorId !== user.id) throw forbidden("...");     // 403
  const body = await parseJsonBody(request, postUpdateSchema); // 안 맞으면 422
  ...
});
```

### 5-4. 인증: 액세스 토큰과 API 키 (`src/lib/api/auth.ts`)

둘 다 `Authorization: Bearer <값>` 으로 받는다. 성격이 달라서 둘 다 있다.

| | 액세스 토큰 | API 키 |
| --- | --- | --- |
| 생김새 | `eyJhbGciOi...` (JWT) | `sk_8cee23a6...` |
| 발급 | `POST /auth/token` (이메일+비번) | `POST /auth/keys` (토큰 필요) |
| 유효기간 | 1시간 | 없음 |
| 저장 | 서버에 저장 안 함 (stateless) | `api_keys` 테이블에 **해시만** |
| 개별 폐기 | 불가 (만료를 기다림) | 가능 (`revoked_at`) |
| 쓰는 곳 | 사용자 대신 행동하는 클라이언트 | 서버-투-서버 배치·봇 |

**왜 쿠키를 안 쓰나.** 브라우저는 쿠키를 자동으로 붙인다 → 남의 사이트가 우리 사용자의 브라우저를 시켜
요청을 보낼 수 있다(CSRF). `Authorization` 헤더는 자동으로 붙지 않으므로 CSRF 가 성립하지 않는다.
그래서 `/api/v1` 은 **쿠키를 아예 읽지 않는다.** 브라우저에 로그인되어 있어도 이 API 에는 401 이 나온다.
덕분에 CORS 를 `Access-Control-Allow-Origin: *` 로 열어도 안전하다 (쿠키 인증을 함께 받는다면 절대 안 된다).

**토큰 혼동(token confusion) 막기.** 액세스 토큰을 세션 쿠키와 같은 키로 서명하면,
API 토큰을 그대로 `session` 쿠키에 붙여 넣어도 검증을 통과한다. 용도가 다른 토큰은 서로 통용되면 안 되므로
`SESSION_SECRET` 에서 HMAC 으로 **파생된 별도 키**를 쓴다. 환경변수는 하나만 관리하면서 두 토큰이 완전히 분리된다.

```ts
const accessTokenKey = new Uint8Array(
  createHmac("sha256", sessionSecret).update("api-access-token-v1").digest(),
);
```

**키는 해시로만 저장한다.** 비밀번호와 같은 원칙이지만 해시 함수는 다르다.

- 비밀번호(`password.ts`) → **scrypt**. 사람이 만든 짧고 추측 가능한 문자열이라 *느린* 해시가 필요하다.
- API 키(`api-keys.ts`) → **SHA-256**. 서버가 만든 256비트 난수라 무차별 대입이 불가능하고,
  매 요청마다 `WHERE key_hash = ?` 로 행을 찾아야 하므로 *빠른* 해시여야 한다.
  (scrypt 는 salt 가 행마다 달라 전체를 훑지 않으면 조회할 수 없다)

**API 키로는 또 다른 API 키를 만들 수 없다** (403). 키 하나가 유출됐을 때 공격자가 스스로 키를 계속
찍어내면 폐기가 의미를 잃기 때문이다. 키 관리는 "방금 비밀번호로 로그인한 사람"(액세스 토큰)만 할 수 있다.

폐기는 행을 지우지 않고 `revoked_at` 만 채운다. 유출 사고가 났을 때 "언제 어떤 키가 쓰였는지"(`last_used_at`)
이력이 남아야 무엇이 노출됐는지 추적할 수 있다.

### 5-5. 공통 처리 래퍼 (`src/lib/api/route.ts`)

모든 엔드포인트가 똑같이 해야 하는 일 — 인증, 레이트 리밋, 예외 → JSON 변환 — 을 한 곳에 모았다.

```ts
export const GET = apiRoute(async ({ request, params, auth }) => { ... });
```

- **인증을 먼저, 레이트 리밋을 나중에.** 누구인지 알아야 사용자 단위로 셀 수 있다.
  반대로 하면 같은 사무실에서 나가는 모든 요청이 IP 하나의 몫을 나눠 쓰게 된다.
- **`Authorization` 헤더가 아예 없으면 익명**(공개 읽기 가능), **있는데 유효하지 않으면 401.**
  조용히 익명 취급하면 개발자가 토큰 만료를 모른 채 빈 결과만 보게 되어 더 나쁘다.
- **예상 못 한 예외는 메시지를 감춘다.** 스택이나 SQL 문구가 응답에 섞이면 내부 구조가 노출된다.
  원인은 서버 로그에만 남기고 클라이언트에는 일반적인 문구만 준다.
- **`unstable_rethrow(error)`** 를 catch 맨 앞에 둔다. Next.js 내부 제어용 에러까지 삼키지 않기 위해서다.

레이트 리밋의 개념과 구현은 바로 아래 5-6 에서 따로 다룬다.

### 5-6. 레이트 리밋 (`src/lib/api/rate-limit.ts`)

**레이트 리밋(rate limit)** 은 "한 사용자가 일정 시간 안에 API 를 몇 번까지 부를 수 있는지" 의 상한이다.
공개 API 는 누가 얼마나 부를지 통제할 수 없으므로, 상한이 없으면 이런 일이 생긴다.

- 무한 루프에 빠진 클라이언트 하나가 서버를 마비시킨다.
- 비밀번호 대입 공격이나 데이터 긁어가기를 무제한으로 할 수 있다.
- 한 사용자 때문에 다른 모든 사용자가 느려진다.

그래서 **공개 API 라면 반드시 상한이 있어야 한다.** GitHub API 가 비인증 사용자에게 시간당 60회를 주는 것도 같은 이유고,
`/releases` 페이지에서 GitHub 응답을 1시간 캐시한 것은 그 한도를 아끼기 위해서였다.

#### 이 프로젝트의 규칙

| 항목 | 값 | 어디서 |
| --- | --- | --- |
| 창(window) | 60초. 지나면 카운터가 0 으로 돌아간다 | `WINDOW_SECONDS` |
| 비로그인 한도 | 분당 60회, **IP 주소** 기준 (`ip:1.2.3.4`) | `ANONYMOUS_LIMIT` (`route.ts`) |
| 로그인 한도 | 분당 600회, **사용자 id** 기준 (`user:3`) | `AUTHENTICATED_LIMIT` (`route.ts`) |
| 초과하면 | 429 `rate_limited` + `Retry-After` 헤더(몇 초 뒤 다시 시도할지) | `apiRoute()` 래퍼 |

카운터를 나누는 기준을 **identity** 라고 부른다. 그래서 래퍼는 인증을 먼저 하고 레이트 리밋을 나중에 한다.
누구인지 알아야 사용자 단위로 셀 수 있고, 로그인 사용자에게 10배를 주는 것은 책임을 물을 수 있는 상대이기 때문이다.

#### 응답 헤더로 상태를 알려 준다

모든 `/api/v1` 응답에 아래 헤더가 붙는다. 클라이언트는 이걸 보고 "남은 게 적으니 천천히 보내자" 같은 판단을 할 수 있다.

```
X-RateLimit-Limit: 60          ← 이 창에서 허용되는 총 횟수
X-RateLimit-Remaining: 53      ← 남은 횟수
X-RateLimit-Reset: 1789...     ← 창이 초기화되는 시각 (Unix 초)
Retry-After: 37                ← 429 일 때만. 이 초만큼 기다렸다가 재시도하는 것이 관례
```

브라우저 JS 가 이 헤더를 읽으려면 CORS 의 `Access-Control-Expose-Headers` 에 올라 있어야 한다 (5-10 참고).

#### 직접 확인해 보기

비로그인으로 1분 안에 61번 부르면 마지막 요청이 429 가 된다.

```bash
for i in $(seq 1 61); do curl -s -o /dev/null -w "%{http_code} " "$B/api/v1/posts?limit=1"; done; echo
curl -s -D - -o /dev/null "$B/api/v1/posts?limit=1" | grep -i "retry-after\|ratelimit"
```

1분 기다리거나 서버를 재시작하면 풀린다.

#### 구현 방식과 한계 (학습용)

`checkRateLimit(identity, limit)` 은 **고정 창(fixed window)** 방식이다. identity 마다 `{ count, resetAt }` 을
`Map` 에 두고, 창이 지났으면 새로 시작하고 아니면 count 를 올린다. 코드가 40줄이라 원리를 보기에 좋지만 실제 서비스에는 부족하다.

| 한계 | 이유 | 실제 서비스에서는 |
| --- | --- | --- |
| 서버가 여러 대면 각자 센다 | 카운터가 프로세스 메모리에만 있다 | Redis 같은 공유 저장소, 또는 Vercel · Cloudflare 등 호스팅 업체의 레이트 리밋 기능 |
| 창 경계에서 순간 2배까지 통과한다 | 59초에 60회, 61초에 60회가 모두 허용된다 | 슬라이딩 윈도, 토큰 버킷 알고리즘 |
| 재시작하면 카운터가 사라진다 | 메모리 기반 | 위와 같음 |
| IP 기준은 회사·학교처럼 NAT 뒤의 여러 사람을 한 명으로 본다 | 어쩔 수 없는 한계 | 로그인을 유도해 사용자 단위로 세도록 한다 |

`pruneExpired` 는 만료된 항목을 가끔 지운다. 안 하면 한 번이라도 접속한 IP 마다 항목이 남아 메모리가 계속 는다.
단위 테스트(`rate-limit.test.ts`)는 `now` 를 인자로 넘겨 시계를 조작하지 않고 창 만료를 검증한다.

### 5-7. Route Handler 에서는 `updateTag` 를 못 쓴다

Part 2 에서 Server Action 은 `updateTag("posts")` 로 캐시를 즉시 만료시켰다.
그런데 **`updateTag` 는 Server Action 전용이라 Route Handler 에서 호출할 수 없다** (Next.js 16).
공개 API 는 Route Handler 이므로 `revalidateTag` 를 쓴다.

```ts
// Server Action (src/app/posts/actions.ts)
updateTag("posts");

// Route Handler (src/app/api/v1/posts/route.ts)
revalidateTag("posts", { expire: 0 });
```

`{ expire: 0 }` 는 "낡은 내용을 내주지 말고 다음 요청이 새로 만들게" 라는 뜻으로, `updateTag` 에 가장 가깝다.
`"max"` 를 주면 stale-while-revalidate 가 되어 다음 요청은 옛 내용을 먼저 받는다.
API 로 방금 글을 쓴 클라이언트가 바로 이어서 목록을 읽는 상황을 생각하면 `{ expire: 0 }` 이 맞다.

`/todos` 화면은 `"use cache"` 가 아니라 `revalidatePath("/todos")` 로 갱신한다(Part 1과 같은 방식).
Route Handler 에서 부르면 "다음에 그 경로를 방문할 때" 다시 렌더링된다.

### 5-8. 캐시되지 않는 조회 함수를 따로 둔 이유

화면용 `getPosts()`, `getPost()` 는 `"use cache"` 라서 최대 1분~1시간 낡은 값을 줄 수 있다.
화면은 그래도 괜찮지만, **API 클라이언트는 방금 POST 로 만든 글이 바로 이어서 GET 되기를 기대한다.**
그래서 `listPosts()`, `findPost()`, `listComments()`, `listTodos()`, `findTodo()` 를 캐시 없이 따로 만들었다.
SQL 은 여전히 `src/lib/` 안에만 있다.

댓글 목록은 화면(`getCommentThreads`)과 달리 **평탄한 배열 + `parentId`** 로 준다.
트리를 잘라서 페이지네이션하면 "부모 없는 답글" 이 생기기 때문이다. 조립은 클라이언트 몫으로 남긴다.

### 5-9. `serialize` — DB 행을 그대로 내보내지 않는다

`src/lib/api/serialize.ts` 가 내부 타입을 공개 JSON 모양으로 바꾼다. 한 겹을 두는 이유는 세 가지다.

1. 컬럼을 추가해도 API 응답이 멋대로 바뀌지 않는다 (내부 구조와 공개 계약의 분리).
2. `password_hash` 같은 값이 실수로 새어 나갈 수 없다 — **여기에 안 적으면 안 나간다.**
3. `imagePath`("uuid.jpg") 처럼 내부에서만 의미 있는 값을 바로 쓸 수 있는 **절대 URL** 로 바꿔 준다.

글 작성자는 `{ id, name }` 만 준다. 공개 목록에 남의 이메일이 보이면 안 되기 때문이다.
반면 `/auth/me` 는 본인 정보라서 이메일을 포함한다.

### 5-10. CORS 는 `proxy.ts` 한 곳에서

라우트마다 헤더를 붙이면 빠뜨리기 쉽다. 프리플라이트(`OPTIONS`) 응답과 CORS 헤더를 proxy 에서 한 번에 처리한다.

```ts
if (pathname.startsWith("/api/v1")) {
  if (request.method === "OPTIONS") return withCors(new NextResponse(null, { status: 204 }));
  return withCors(NextResponse.next());
}
```

`Access-Control-Expose-Headers` 를 지정해야 브라우저 JS 가 `X-RateLimit-*` 을 읽을 수 있다.
기본적으로 JS 는 몇 개 안 되는 헤더만 볼 수 있기 때문이다.

### 5-11. 빌드 결과에서 확인하기

`npm run build` 표에서 `/api/v1` 과 `/api/v1/openapi.json` 만 `○ (Static)` 이다.
두 라우트는 요청 정보를 전혀 읽지 않아서 빌드 시점에 미리 만들어진다.
나머지는 전부 `ƒ (Dynamic)` 인데, `Authorization` 헤더를 읽는 순간 "요청마다 실행" 으로 확정되기 때문이다.
Cache Components 에서 **Route Handler 도 페이지와 같은 규칙**을 따른다는 것을 눈으로 보는 지점이다.

---

## 빌드 결과 읽는 법

`npm run build` 마지막에 출력되는 표:

```
◐ /                    Partial Prerender   (헤더의 로그인 상태가 Suspense 안에서 스트리밍)
◐ /login, /signup      Partial Prerender
◐ /posts               Partial Prerender   (목록은 요청 시 q·page 조합별로 "use cache", 1분 재검증)
◐ /posts/[id]          Partial Prerender
◐ /posts/[id]/edit     Partial Prerender
◐ /client-fetch        Partial Prerender
◐ /feed          Partial Prerender   (첫 페이지는 셸에, 이후는 브라우저 fetch)
◐ /releases      Partial Prerender   (Revalidate 1h — 외부 API 캐시)
◐ /todos               Partial Prerender
ƒ /api/posts           Dynamic
ƒ /api/todos           Dynamic
ƒ /api/uploads/[name]  Dynamic
ƒ Proxy (Middleware)                        (src/proxy.ts)
```

인증을 붙이기 전에는 `/`, `/posts`, `/client-fetch` 가 `○ Static` 이었다. 헤더에서 세션을 읽기 시작하면서 전부 `◐` 가 됐지만, 세션 부분만 Suspense 안에 있으므로 나머지는 여전히 정적 셸로 즉시 나간다.

| 기호 | 의미 |
| --- | --- |
| `○` Static | 빌드 시 정적 HTML 생성 (SSG). `Revalidate` 가 있으면 ISR |
| `◐` Partial Prerender | 정적 셸은 빌드 시 생성, 동적 부분은 요청 시 스트리밍 |
| `ƒ` Dynamic | 요청마다 서버에서 렌더링 (SSR) |

---

## 데이터베이스

SQLite 파일 하나를 DB 로 사용한다. 파일 경로는 `.env` 의 `DATABASE_PATH` 로 정하며 기본값은 `data/app.db` 다.
DB 파일(`data/*.db`)은 git 에 올리지 않는다. 대신 스키마와 시드 데이터를 스크립트로 관리한다.

| 명령 | 동작 |
| --- | --- |
| `npm run db:init` | DB 파일과 테이블 생성. 이미 있으면 아무것도 하지 않음 |
| `npm run db:seed` | 비어 있는 테이블에만 샘플 데이터 삽입 |
| `npm run db:seed -- --reset` | 모든 테이블을 비우고 샘플 데이터로 다시 채움 (id 도 1부터) |

테이블은 `users`, `todos`, `posts`, `comments`, `api_keys` 다 (정의는 `src/lib/schema.ts`).
`api_keys` 는 공개 API 용이며, 키 원문은 저장하지 않고 SHA-256 해시만 넣는다 (Part 5-4).

샘플 데이터는 `scripts/seed-db.mts` 의 `SEED_TODOS`, `SEED_POSTS` 배열을 수정하면 된다.
완전히 초기 상태로 돌리려면 `data/app.db`, `data/app.db-wal`, `data/app.db-shm` 을 지우고 다시 실행한다.

## shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component>   # 예: npx shadcn@latest add table
```

설치된 컴포넌트는 `src/components/ui/` 에 생성된다.
현재 포함: button, card, input, label, badge, separator, dialog, dropdown-menu, sonner, checkbox, textarea, skeleton

## 구조

```
.env.example        # 환경변수 템플릿 (DATABASE_PATH, SESSION_SECRET)
vitest.config.mts   # 단위/컴포넌트 테스트 설정
playwright.config.ts # E2E 설정 (빌드 → 3100 포트 → data/e2e.db)
e2e/                # Playwright 테스트
next.config.ts      # cacheComponents: true
data/               # SQLite 파일과 업로드 이미지 (git 제외)
docs/NEXT_STEPS.md  # 이후에 추가할 학습 항목
scripts/
  init-db.mts       # DB 파일 / 테이블 생성
  seed-db.mts       # 샘플 데이터 삽입
src/
  test/             # Vitest setup (임시 DB, 환경변수, jest-dom, cleanup)
  proxy.ts          # 요청 전 낙관적 리다이렉트 (인증 보조)
  app/
    layout.tsx      # 루트 레이아웃 (헤더 + Suspense 안의 로그인 상태)
    (auth)/         # 라우트 그룹 (URL 에 안 들어감)
      layout.tsx    # 로그인/가입 공용 레이아웃
      actions.ts    # 가입 / 로그인 / 로그아웃 Server Actions
      auth-form.tsx # 공용 폼
      login/, signup/
    page.tsx        # 홈 (SSG)
    globals.css     # Tailwind + shadcn 테마 변수
    todos/
      page.tsx      # 목록 + 조회 (SSR, connection())
      loading.tsx   # Suspense 경계
      actions.ts    # Server Actions (추가 / 토글 / 수정 / 삭제)
      *.tsx         # 클라이언트 컴포넌트 (useActionState, useOptimistic, useTransition)
    (demos)/        # 라우트 그룹 (URL 에 안 들어감). 인터셉팅 라우트와 충돌해 /posts 밖으로 옮긴 데모들
      layout.tsx    # 공용 네비게이션 + TanStack Query Provider
      template.tsx  # 세그먼트가 바뀔 때마다 재마운트 (진입 애니메이션)
      feed/         # /feed 무한 스크롤 (page.tsx: 첫 페이지 서버 렌더링, post-feed.tsx: useInfiniteQuery + IntersectionObserver)
      client-fetch/ # /client-fetch 클라이언트 페칭 3종 비교 (post-count: fetch, post-search: SWR, post-search-query: TanStack Query)
      releases/     # /releases 외부 API + use() (page.tsx: Promise 전달, release-list.tsx: use() 로 읽기)
    posts/
      layout.tsx    # 공용 네비게이션 + @modal 슬롯 렌더링
      @modal/
        default.tsx       # 슬롯 기본값 (null)
        (.)[id]/page.tsx  # 인터셉팅 라우트: 글 상세를 모달로
      page.tsx      # 목록 (use cache, ISR)
      actions.ts    # 작성 / 수정 / 삭제 / 댓글 (모두 세션 검사) / 캐시 갱신
      post-form.tsx # 작성·수정 공용 폼
      error.tsx     # Error Boundary
      cache-controls.tsx, new-post-form.tsx
      [id]/
        page.tsx          # 동적 라우트, generateStaticParams, Suspense
        loading.tsx       # 로딩 스켈레톤
        not-found.tsx     # notFound() 결과
        other-posts.tsx   # 1.5초 지연 스트리밍
        post-owner-actions.tsx  # 작성자에게만 수정/삭제 (Suspense 안)
        comments-section.tsx    # 2단 댓글 (캐시된 목록 + 현재 사용자)
        comment-form.tsx, reply-toggle.tsx, delete-comment-button.tsx
        edit/page.tsx     # 글 수정 (작성자만, 이미지 교체/삭제)
        recently-viewed.tsx        # localStorage 위젯 (브라우저 전용)
        recently-viewed-loader.tsx # next/dynamic ssr:false 래퍼
        error-trigger.tsx, delete-post-button.tsx
    p/[id]/page.tsx # permanentRedirect 예 (/p/3 → /posts/3)
    api/
      todos/route.ts  # REST API 예시 (내부용, 데모 화면이 사용)
      posts/route.ts  # 검색 API (?q=) / 커서 페이지 API (?cursor=&limit=) — 내부용
      uploads/[name]/route.ts  # 업로드 이미지 파일 응답
      v1/             # 공개 API (Part 5). 외부 개발자용 계약, 버전 고정
        route.ts              # 진입점 (정적. 엔드포인트 목록)
        openapi.json/route.ts # OpenAPI 3.1 명세 (정적)
        auth/
          register/, token/, me/   # 가입 / 토큰 발급 / 신원 확인
          keys/route.ts, keys/[id]/route.ts  # API 키 발급·목록·폐기
        posts/route.ts, posts/[id]/route.ts  # 목록·작성 / 조회·수정·삭제
        posts/[id]/comments/route.ts         # 댓글 목록·작성
        comments/[id]/route.ts               # 댓글 삭제
        todos/route.ts, todos/[id]/route.ts
        */*.test.ts   # 라우트 핸들러를 직접 호출하는 테스트
  components/
    ui/             # shadcn/ui 컴포넌트
    modal.tsx       # 라우트 모달 껍데기 (router.back 으로 닫기)
    posts-nav.tsx   # /posts 와 (demos) 가 공유하는 네비게이션
    query-providers.tsx  # QueryClientProvider + DevTools
    user-menu.tsx   # 헤더 로그인 상태 (서버 컴포넌트)
  lib/
    schema.ts       # 테이블 정의 + 수동 마이그레이션 (앱과 스크립트가 공유)
    schemas/        # Zod 검증 스키마 (post, auth, comment, api)
    api/            # 공개 API 인프라 (Part 5)
      route.ts      # apiRoute() 래퍼: 인증 + 레이트 리밋 + 예외 → JSON
      http.ts       # 응답 봉투(data/error), ApiError, 본문·쿼리 파싱
      auth.ts       # Bearer 인증 (액세스 토큰 JWT / API 키), requireAuth
      rate-limit.ts # 고정 윈도 레이트 리밋
      serialize.ts  # 내부 타입 → 공개 JSON (password_hash 유출 차단)
      openapi.ts    # OpenAPI 3.1 문서
    api-keys.ts     # api_keys 접근 함수 (SHA-256 해시 저장, 폐기)
    *.test.ts       # 각 모듈 옆에 두는 테스트 (colocated)
    password.ts     # scrypt 해시 / 검증
    session.ts      # JWT 세션 쿠키 생성 / 검증 / 삭제
    dal.ts          # getCurrentUser(), requireUser()
    users.ts        # users 접근 함수
    comments.ts     # comments 접근 함수 (2단 트리, 태그별 캐시)
    github.ts       # 외부 API fetch ("use cache")
    uploads.ts, uploads-validate.ts  # 이미지 저장/삭제/읽기, 검증 규칙
    db.ts           # SQLite 연결 (앱 전체에서 하나 공유)
    todos.ts        # todos 접근 함수 (connection() 으로 SSR)
    posts.ts        # posts 접근 함수 (일부 "use cache")
    utils.ts        # cn() 헬퍼
```
