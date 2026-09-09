/**
 * 학습용 초기 데이터(시드)를 넣는 스크립트. 앱과 무관하게 터미널에서 실행한다.
 *
 *   npm run db:seed              # 비어 있는 테이블에만 샘플 데이터 삽입 (데이터가 있으면 건너뜀)
 *   npm run db:seed -- --reset   # 기존 데이터를 모두 지우고 샘플 데이터로 다시 채움
 *
 * DB 파일 경로는 .env 의 DATABASE_PATH 를 따른다 (기본값 data/app.db).
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? "data/app.db",
);
const reset = process.argv.includes("--reset");

// 샘플 데이터. 여기를 수정하면 다음 시드부터 반영된다.
const SEED_TODOS: { title: string; completed: boolean }[] = [
  { title: "Next.js App Router 구조 살펴보기", completed: true },
  { title: "SQLite 연결 코드(src/lib/db.ts) 읽어보기", completed: true },
  { title: "Server Action 으로 할 일 추가해 보기", completed: false },
  { title: "useOptimistic 동작 확인하기 (체크박스 토글)", completed: false },
  { title: "/api/todos Route Handler 를 브라우저에서 열어보기", completed: false },
  { title: "/posts 에서 ISR 과 스트리밍 확인하기", completed: false },
];

const SEED_POSTS: { title: string; content: string }[] = [
  {
    title: "Cache Components 란?",
    content:
      "Next.js 16 의 캐싱 모델. 기본은 캐시하지 않고, 'use cache' 를 붙인 함수/컴포넌트만 캐시한다.\n\n이 글 목록(/posts)은 'use cache' + cacheLife 로 캐시되어 있어서, 새로고침해도 캐시 생성 시각이 바뀌지 않는다. 글을 추가하면 updateTag 로 캐시가 즉시 갱신된다.",
  },
  {
    title: "동적 라우트와 generateStaticParams",
    content:
      "/posts/[id] 는 동적 세그먼트다. generateStaticParams 가 돌려준 id 는 빌드 시 미리 렌더링되고, 나머지 id 는 첫 요청 때 렌더링된 뒤 캐시된다. 이것이 Cache Components 시대의 ISR 이다.",
  },
  {
    title: "loading, error, not-found 특수 파일",
    content:
      "loading.tsx 는 세그먼트 전체를 Suspense 로 감싸고, error.tsx 는 Error Boundary 로 감싼다. notFound() 를 호출하면 같은 세그먼트의 not-found.tsx 가 렌더링된다.\n\n이 글 상세 페이지에서 '에러 발생시키기' 버튼을 눌러 error.tsx 를, 없는 id (/posts/9999) 로 접속해 not-found.tsx 를 확인해 보자.",
  },
  {
    title: "Suspense 스트리밍",
    content:
      "페이지의 일부가 느려도 나머지를 먼저 보낼 수 있다. 이 글 하단의 '다른 글' 목록은 일부러 1.5초 지연시킨 뒤 스트리밍된다. 글 본문은 캐시에서 즉시 나오고, 목록만 나중에 채워지는 것을 볼 수 있다.",
  },
  {
    title: "클라이언트 사이드 데이터 페칭",
    content:
      "서버 컴포넌트가 아니라 브라우저에서 fetch 로 데이터를 가져오는 방식. /posts/client 에서 SWR 과 useEffect+fetch 두 가지를 비교해 볼 수 있다. 검색처럼 사용자 입력에 따라 바뀌는 데이터에 적합하다.",
  },
];

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");

// 테이블이 없으면 생성 (db:init 을 먼저 실행하지 않아도 동작하도록)
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS posts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

function countRows(table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
    count: number;
  };
  return row.count;
}

// 테이블 하나를 시드한다. 데이터가 있으면 건너뛰고, --reset 이면 비우고 다시 넣는다.
function seedTable(table: string, insertSql: string, rows: unknown[][]) {
  const count = countRows(table);
  if (count > 0 && !reset) {
    console.log(`${table}: 이미 ${count}건이 있어 건너뜁니다. (--reset 으로 초기화 가능)`);
    return;
  }
  // 여러 건을 하나의 트랜잭션으로 묶어 중간에 실패하면 전부 되돌린다.
  db.exec("BEGIN");
  try {
    if (reset) {
      db.exec(`DELETE FROM ${table}`);
      // AUTOINCREMENT 카운터도 초기화해 id 가 1부터 다시 시작하게 한다
      db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
    }
    const insert = db.prepare(insertSql);
    for (const row of rows) insert.run(...(row as (string | number)[]));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  console.log(`${table}: ${reset ? "초기화 후 " : ""}샘플 ${rows.length}건 삽입`);
}

seedTable(
  "todos",
  "INSERT INTO todos (title, completed) VALUES (?, ?)",
  SEED_TODOS.map((t) => [t.title, t.completed ? 1 : 0]),
);
seedTable(
  "posts",
  "INSERT INTO posts (title, content) VALUES (?, ?)",
  SEED_POSTS.map((p) => [p.title, p.content]),
);

console.log(`완료: ${DB_PATH}`);
db.close();
