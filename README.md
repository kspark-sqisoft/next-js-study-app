# next-js-study-app

Next.js 학습용 프로젝트. SQLite 를 붙인 간단한 투두 앱이 들어 있다.

## 스택

- Next.js 16 (App Router, Turbopack)
- TypeScript
- Tailwind CSS v4
- shadcn/ui (style: base-nova, base color: neutral, icons: lucide)
- SQLite (Node.js 내장 `node:sqlite`, 별도 패키지 없음)
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

## shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component>   # 예: npx shadcn@latest add table
```

설치된 컴포넌트는 `src/components/ui/` 에 생성된다.
현재 포함: button, card, input, label, badge, separator, dialog, dropdown-menu, sonner, checkbox

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
    api/todos/
      route.ts      # REST API 예시
  components/ui/    # shadcn/ui 컴포넌트
  lib/
    db.ts           # SQLite 연결 (앱 전체에서 하나 공유)
    todos.ts        # todos 테이블 접근 함수 (SQL 은 여기에만)
    utils.ts        # cn() 헬퍼
```
