/**
 * 학습용 초기 데이터(시드)를 넣는 스크립트. 앱과 무관하게 터미널에서 실행한다.
 *
 *   npm run db:seed              # todos 가 비어 있을 때만 샘플 데이터 삽입 (이미 있으면 건너뜀)
 *   npm run db:seed -- --reset   # 기존 todos 를 모두 지우고 샘플 데이터로 다시 채움
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
  { title: "ISR 예제 페이지 만들어 보기", completed: false },
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
`);

const { count } = db
  .prepare("SELECT COUNT(*) AS count FROM todos")
  .get() as { count: number };

if (count > 0 && !reset) {
  console.log(`todos 에 이미 ${count}건이 있어 시드를 건너뜁니다. (--reset 으로 초기화 가능)`);
  db.close();
  process.exit(0);
}

// 여러 건을 하나의 트랜잭션으로 묶어 중간에 실패하면 전부 되돌린다.
db.exec("BEGIN");
try {
  if (reset) {
    db.exec("DELETE FROM todos");
    // AUTOINCREMENT 카운터도 초기화해 id 가 1부터 다시 시작하게 한다
    db.exec("DELETE FROM sqlite_sequence WHERE name = 'todos'");
  }
  const insert = db.prepare(
    "INSERT INTO todos (title, completed) VALUES (?, ?)",
  );
  for (const todo of SEED_TODOS) {
    insert.run(todo.title, todo.completed ? 1 : 0);
  }
  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

console.log(
  `${reset ? "초기화 후 " : ""}샘플 데이터 ${SEED_TODOS.length}건을 넣었습니다: ${DB_PATH}`,
);
db.close();
