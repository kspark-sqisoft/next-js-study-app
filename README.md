# next-js-study-app

Next.js 16 (App Router) 학습용 프로젝트. SQLite 를 붙인 작은 앱 두 개(todos, posts)에 핵심 개념을 하나씩 심어 두었다.
**README 의 개념 설명 → 해당 파일의 주석 → 브라우저에서 동작 확인** 순서로 보면 된다.

## 스택

- Next.js 16 (App Router, Turbopack, Cache Components)
- React 19, TypeScript
- Tailwind CSS v4, shadcn/ui (style: base-nova)
- SQLite (Node.js 내장 `node:sqlite`, 별도 패키지 없음)
- SWR, TanStack Query (클라이언트 사이드 페칭 비교용)
- ESLint

## 시작하기

```bash
npm install
cp .env.example .env   # DB 파일 경로 설정
npm run db:seed        # 샘플 데이터 넣기
npm run dev            # http://localhost:3000
```

그 외 명령:

```bash
npm run build          # 프로덕션 빌드. 라우트별 렌더링 방식(○ ◐ ƒ)이 출력된다
npm run start          # 빌드 결과 실행
npm run lint
npm run db:init        # DB 파일/테이블만 생성 (앱 첫 실행 시 자동으로도 됨)
npm run db:seed -- --reset   # 샘플 데이터로 초기화
```

---

## 렌더링 방식 개념 (SSG · SSR · CSR · ISR)

"HTML 을 **언제, 어디서** 만드는가" 로 구분한다. 이 프로젝트에서 각 방식이 어디에 쓰였는지 함께 적었다.

| 방식 | 언제 | 어디서 | 장점 | 단점 | 이 프로젝트 |
| --- | --- | --- | --- | --- | --- |
| **SSG** (Static Site Generation) | 빌드 시 1회 | 서버(빌드 머신) | 가장 빠름. CDN 에 그대로 올릴 수 있음 | 데이터가 바뀌면 다시 빌드해야 함 | `/`, `/posts/client` |
| **SSR** (Server-Side Rendering) | 요청마다 | 서버 | 항상 최신 데이터. 첫 화면에 내용이 있어 SEO 유리 | 요청마다 서버 부하. 응답까지 기다려야 함 | `/todos`, `/api/*` |
| **CSR** (Client-Side Rendering) | 브라우저에서 JS 실행 후 | 브라우저 | 상호작용이 풍부. 서버 부담 적음 | 첫 화면이 비어 있음(로딩). SEO 불리 | `/posts/client` 의 검색 결과, `"use client"` 컴포넌트의 상호작용 |
| **ISR** (Incremental Static Regeneration) | 빌드 시 1회 + 주기/이벤트로 재생성 | 서버 | SSG 의 속도 + 데이터 갱신 가능 | 갱신 직후 잠깐 이전 데이터가 보일 수 있음 | `/posts` 목록, `/posts/[id]` 상세 |

### SSG — 미리 만들어 두기

빌드할 때 HTML 을 만들어 두고, 요청이 오면 그 파일을 그대로 준다. 방문자 수와 무관하게 서버가 일을 하지 않는다.
App Router 에서는 **요청별 데이터를 안 쓰면 자동으로 SSG** 가 된다. `src/app/page.tsx` 에 아무 설정이 없는데 빌드 결과에 `○ Static` 으로 나오는 이유다.

### SSR — 요청마다 만들기

요청이 올 때마다 서버가 DB 를 읽고 HTML 을 만들어 준다. 항상 최신이지만 매번 비용이 든다.
`/todos` 가 SSR 인 이유는 `src/lib/todos.ts` 의 `await connection()` 때문이다. "요청이 들어온 다음에 실행하라" 는 표시라서, 이 줄이 없으면 빌드 시점에 한 번 실행되어 SSG 가 되어 버린다.

### CSR — 브라우저에서 만들기

서버는 거의 빈 HTML 과 JS 만 주고, 브라우저가 JS 를 실행해 API 를 호출하고 화면을 그린다. 예전 SPA(React 만 쓰던 시절) 의 기본 방식이다.
App Router 에서 순수 CSR 은 드물다. `/posts/client` 가 가장 가깝다: 페이지 뼈대는 SSG 로 미리 만들어지고, **검색 결과만** 브라우저에서 `/api/posts` 를 호출해 그린다.

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
| 12 | 클라이언트 사이드 페칭: fetch, SWR, TanStack Query | `src/app/posts/client/` |

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

### 2-7. 클라이언트 사이드 페칭 (`src/app/posts/client/`)

서버 컴포넌트가 아니라 브라우저에서 `/api/posts` 를 호출한다. 검색처럼 사용자 입력에 따라 계속 바뀌는 데이터에 적합하다. 같은 검색 기능을 세 가지로 구현해 비교한다.

| 파일 | 방식 | 특징 |
| --- | --- | --- |
| `post-count.tsx` | `useEffect` + `fetch` | 라이브러리 없음. 로딩/에러/취소(`AbortController`) 를 직접 처리해야 한다 |
| `post-search.tsx` | SWR `useSWR(key, fetcher)` | 키(URL) 기반 캐시, 중복 요청 제거, 포커스 시 자동 갱신. 작고 단순 |
| `post-search-query.tsx` | TanStack Query `useQuery({ queryKey, queryFn })` | 배열 쿼리 키, 풍부한 옵션, DevTools. `providers.tsx` 의 `QueryClientProvider` 가 필요 |

SWR 과 TanStack Query 는 같은 문제를 푸는 경쟁 라이브러리다. Next.js 의 `"use cache"` 가 **서버 캐시** 라면 이들은 **브라우저 캐시** 로, 층위가 달라 대체 관계가 아니다.

`layout.tsx` 에서 Provider 를 `/posts/client` 세그먼트에만 적용했다. 앱 전체(root layout)에 두지 않은 것은 필요한 범위에만 두기 위해서다.

---

## 빌드 결과 읽는 법

`npm run build` 마지막에 출력되는 표:

```
○ /                    Static
○ /posts               Static  (Revalidate 1m, Expire 1h)
◐ /posts/[id]          Partial Prerender
◐ /posts/5             Partial Prerender
○ /posts/client        Static
◐ /todos               Partial Prerender
ƒ /api/posts           Dynamic
ƒ /api/todos           Dynamic
```

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
.env.example        # 환경변수 템플릿 (복사해서 .env 로 사용)
next.config.ts      # cacheComponents: true
data/               # SQLite 파일 위치 (git 제외)
scripts/
  init-db.mts       # DB 파일 / 테이블 생성
  seed-db.mts       # 샘플 데이터 삽입
src/
  app/
    layout.tsx      # 루트 레이아웃 (폰트, 전역 CSS, 토스트)
    page.tsx        # 홈 (SSG)
    globals.css     # Tailwind + shadcn 테마 변수
    todos/
      page.tsx      # 목록 + 조회 (SSR, connection())
      loading.tsx   # Suspense 경계
      actions.ts    # Server Actions (추가 / 토글 / 수정 / 삭제)
      *.tsx         # 클라이언트 컴포넌트 (useActionState, useOptimistic, useTransition)
    posts/
      layout.tsx    # /posts 공통 네비게이션
      page.tsx      # 목록 (use cache, ISR)
      actions.ts    # 작성 / 삭제 / updateTag / revalidateTag
      error.tsx     # Error Boundary
      cache-controls.tsx, new-post-form.tsx
      [id]/
        page.tsx          # 동적 라우트, generateStaticParams, Suspense
        loading.tsx       # 로딩 스켈레톤
        not-found.tsx     # notFound() 결과
        other-posts.tsx   # 1.5초 지연 스트리밍
        error-trigger.tsx, delete-post-button.tsx
      client/
        layout.tsx        # TanStack Query Provider 적용 범위
        providers.tsx     # QueryClientProvider + DevTools
        page.tsx          # 세 방식 비교 페이지
        post-count.tsx    # useEffect + fetch
        post-search.tsx   # SWR
        post-search-query.tsx  # TanStack Query
    api/
      todos/route.ts  # REST API 예시
      posts/route.ts  # 검색 API (?q=)
  components/ui/    # shadcn/ui 컴포넌트
  lib/
    db.ts           # SQLite 연결 (앱 전체에서 하나 공유)
    todos.ts        # todos 접근 함수 (connection() 으로 SSR)
    posts.ts        # posts 접근 함수 (일부 "use cache")
    utils.ts        # cn() 헬퍼
```
