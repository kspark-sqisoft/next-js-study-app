# next-js-study-app

Next.js 학습용 프로젝트. SQLite 를 붙인 간단한 투두 앱이 들어 있다.

## 스택

- Next.js 16 (App Router, Turbopack)
- TypeScript
- Tailwind CSS v4
- shadcn/ui (style: base-nova, base color: neutral, icons: lucide)
- SQLite (Node.js 내장 `node:sqlite`, 별도 패키지 없음)
- Cache Components (`cacheComponents: true`) — `"use cache"`, `cacheLife`, `cacheTag`
- SWR (클라이언트 사이드 페칭 데모)
- ESLint

## 시작하기

```bash
npm install
cp .env.example .env   # DB 파일 경로 설정
npm run db:seed        # 샘플 데이터 넣기 (선택)
npm run dev            # http://localhost:3000
```

그 외 명령:

```bash
npm run build
npm run start
npm run lint
```

## 데이터베이스

SQLite 파일 하나를 DB 로 사용한다. 파일 경로는 `.env` 의 `DATABASE_PATH` 로 정하며 기본값은 `data/app.db` 다.
DB 파일(`data/*.db`)은 git 에 올리지 않는다. 대신 스키마와 시드 데이터를 스크립트로 관리한다.

| 명령 | 동작 |
| --- | --- |
| `npm run db:init` | DB 파일과 테이블 생성. 이미 있으면 아무것도 하지 않음. 앱 첫 실행 시 자동으로도 되므로 필수는 아님 |
| `npm run db:seed` | `todos` 가 비어 있을 때만 샘플 데이터 삽입. 데이터가 있으면 건너뜀 |
| `npm run db:seed -- --reset` | 기존 `todos` 를 모두 지우고 샘플 데이터로 다시 채움 (id 도 1부터 재시작) |

샘플 데이터 내용은 `scripts/seed-db.mts` 의 `SEED_TODOS` 배열을 수정하면 된다.

DB 를 완전히 처음 상태로 돌리고 싶으면 `data/app.db`, `data/app.db-wal`, `data/app.db-shm` 을 지운 뒤 다시 실행하면 된다.

## 페이지와 API

| 경로 | 설명 |
| --- | --- |
| `/` | 홈. 정적 페이지 (SSG) |
| `/todos` | 투두 관리. 추가 / 완료 토글 / 제목 수정 / 삭제 / 완료 항목 일괄 삭제. 요청마다 DB 를 읽는다 (SSR) |
| `/api/todos` | Route Handler 예시. `GET` 으로 전체 목록을 JSON 으로 반환 |
| `/posts` | 글 목록. `"use cache"` + `cacheLife("minutes")` 로 캐시 (ISR). 캐시 생성 시각 표시, updateTag / revalidateTag 비교 버튼, 글 작성 |
| `/posts/[id]` | 동적 라우트 + `generateStaticParams`(최신 2개만 빌드 시 생성). `loading.tsx`, `not-found.tsx`, `error.tsx` 데모. 하단 "다른 글"은 1.5초 지연 후 Suspense 스트리밍 |
| `/posts/client` | 클라이언트 사이드 페칭. SWR 검색과 `useEffect + fetch` 비교 |
| `/api/posts?q=` | 검색 API. 클라이언트 페칭 데모가 호출 (0.5초 지연) |

### 렌더링 방식 한눈에 보기

`npm run build` 결과의 기호로 각 페이지의 렌더링 방식을 확인할 수 있다.

| 기호 | 의미 | 해당 페이지 |
| --- | --- | --- |
| `○` Static | 빌드 시 정적 HTML 생성 (SSG) | `/`, `/posts`, `/posts/client` |
| `◐` Partial Prerender | 정적 셸 + 동적 부분 스트리밍 | `/posts/[id]`, `/todos` |
| `ƒ` Dynamic | 요청마다 서버 렌더링 (SSR) | `/api/posts`, `/api/todos` |

`/posts` 의 `Revalidate 1m` 은 ISR 주기다. 1분이 지난 뒤 첫 요청에서 백그라운드로 다시 생성된다.

## shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component>   # 예: npx shadcn@latest add table
```

설치된 컴포넌트는 `src/components/ui/` 에 생성된다.
현재 포함: button, card, input, label, badge, separator, dialog, dropdown-menu, sonner, checkbox, textarea, skeleton

## 구조

```
.env.example        # 환경변수 템플릿 (복사해서 .env 로 사용)
data/               # SQLite 파일 위치 (git 제외)
scripts/
  init-db.mts       # DB 파일 / 테이블 생성
  seed-db.mts       # 샘플 데이터 삽입
src/
  app/
    layout.tsx      # 루트 레이아웃
    page.tsx        # 홈
    globals.css     # Tailwind + shadcn 테마 변수
    todos/
      page.tsx      # 투두 페이지 (서버 컴포넌트)
      actions.ts    # Server Actions (추가 / 토글 / 수정 / 삭제)
      *.tsx         # 클라이언트 컴포넌트 (폼, 항목, 버튼)
    posts/
      layout.tsx    # /posts 공통 네비게이션
      page.tsx      # 목록 (use cache, ISR)
      actions.ts    # 작성 / 삭제 / 캐시 갱신 Server Actions
      error.tsx     # Error Boundary
      [id]/         # 동적 라우트: page, loading, not-found, 스트리밍 컴포넌트
      client/       # 클라이언트 사이드 페칭 (SWR, fetch)
    api/
      todos/route.ts  # REST API 예시
      posts/route.ts  # 검색 API
  components/ui/    # shadcn/ui 컴포넌트
  lib/
    db.ts           # SQLite 연결 (앱 전체에서 하나 공유)
    todos.ts        # todos 테이블 접근 함수 (SQL 은 여기에만)
    posts.ts        # posts 테이블 접근 함수. 일부는 "use cache"
    utils.ts        # cn() 헬퍼
```
