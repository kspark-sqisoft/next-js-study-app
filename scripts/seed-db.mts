/**
 * 학습용 초기 데이터(시드)를 넣는 스크립트. 앱과 무관하게 터미널에서 실행한다.
 *
 *   npm run db:seed              # 비어 있는 테이블에만 샘플 데이터 삽입 (데이터가 있으면 건너뜀)
 *   npm run db:seed -- --reset   # 기존 데이터를 모두 지우고 샘플 데이터로 다시 채움
 *
 * 샘플 계정 (비밀번호는 둘 다 password123):
 *   demo@example.com  / 데모     ← 샘플 글 대부분의 작성자
 *   guest@example.com / 게스트   ← 다른 사람 글은 "보기만" 되는지 확인할 때 사용
 *
 * DB 파일 경로는 .env 의 DATABASE_PATH 를 따른다 (기본값 data/app.db).
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { ensureSchema } from "../src/lib/schema.ts";
import { hashPassword } from "../src/lib/password.ts";

const DB_PATH = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "data/app.db");
const reset = process.argv.includes("--reset");

// ---- 샘플 데이터. 여기를 수정하면 다음 시드부터 반영된다. ----

const SEED_USERS = [
  { email: "demo@example.com", name: "데모", password: "password123" },
  { email: "guest@example.com", name: "게스트", password: "password123" },
];

const SEED_TODOS: { title: string; completed: boolean }[] = [
  { title: "Next.js App Router 구조 살펴보기", completed: true },
  { title: "SQLite 연결 코드(src/lib/db.ts) 읽어보기", completed: true },
  { title: "Server Action 으로 할 일 추가해 보기", completed: false },
  { title: "useOptimistic 동작 확인하기 (체크박스 토글)", completed: false },
  { title: "/api/todos Route Handler 를 브라우저에서 열어보기", completed: false },
  { title: "/posts 에서 ISR 과 스트리밍 확인하기", completed: false },
  { title: "demo 계정으로 로그인해서 글 수정해 보기", completed: false },
];

// author: SEED_USERS 의 인덱스 (0 = 데모, 1 = 게스트)
const SEED_POSTS: { title: string; content: string; author: number }[] = [
  {
    title: "Cache Components 란?",
    author: 0,
    content:
      "Next.js 16 의 캐싱 모델. 기본은 캐시하지 않고, 'use cache' 를 붙인 함수/컴포넌트만 캐시한다.\n\n이 글 목록(/posts)은 'use cache' + cacheLife 로 캐시되어 있어서, 새로고침해도 캐시 생성 시각이 바뀌지 않는다. 글을 추가하면 updateTag 로 캐시가 즉시 갱신된다.",
  },
  {
    title: "동적 라우트와 generateStaticParams",
    author: 0,
    content:
      "/posts/[id] 는 동적 세그먼트다. generateStaticParams 가 돌려준 id 는 빌드 시 미리 렌더링되고, 나머지 id 는 첫 요청 때 렌더링된 뒤 캐시된다. 이것이 Cache Components 시대의 ISR 이다.",
  },
  {
    title: "loading, error, not-found 특수 파일",
    author: 0,
    content:
      "loading.tsx 는 세그먼트 전체를 Suspense 로 감싸고, error.tsx 는 Error Boundary 로 감싼다. notFound() 를 호출하면 같은 세그먼트의 not-found.tsx 가 렌더링된다.\n\n이 글 상세 페이지에서 '에러 발생시키기' 버튼을 눌러 error.tsx 를, 없는 id (/posts/9999) 로 접속해 not-found.tsx 를 확인해 보자.",
  },
  {
    title: "Suspense 스트리밍",
    author: 0,
    content:
      "페이지의 일부가 느려도 나머지를 먼저 보낼 수 있다. 이 글 하단의 '다른 글' 목록은 일부러 1.5초 지연시킨 뒤 스트리밍된다. 글 본문은 캐시에서 즉시 나오고, 목록만 나중에 채워지는 것을 볼 수 있다.",
  },
  {
    title: "클라이언트 사이드 데이터 페칭",
    author: 0,
    content:
      "서버 컴포넌트가 아니라 브라우저에서 fetch 로 데이터를 가져오는 방식. /posts/client 에서 SWR, TanStack Query, useEffect+fetch 세 가지를 비교해 볼 수 있다.",
  },
  {
    title: "인증과 권한: 이 글은 게스트가 썼습니다",
    author: 1,
    content:
      "demo 계정으로 로그인하면 이 글에는 수정/삭제 버튼이 보이지 않는다. 작성자(guest)만 수정할 수 있다.\n\n버튼을 숨기는 것은 편의일 뿐이고, 실제 검사는 Server Action 안에서 세션을 다시 읽어서 한다 (src/app/posts/actions.ts).",
  },
];

// post: SEED_POSTS 인덱스, author: SEED_USERS 인덱스, parent: 같은 배열 안의 인덱스 (답글일 때)
const SEED_COMMENTS: { post: number; author: number; content: string; parent?: number }[] = [
  { post: 0, author: 1, content: "캐시 생성 시각이 진짜 안 바뀌네요. 신기합니다." },
  { post: 0, author: 0, content: "1분 지나고 새로고침 두 번 해 보세요. 백그라운드 재생성이 보입니다.", parent: 0 },
  { post: 0, author: 1, content: "확인했습니다. 감사합니다!", parent: 0 },
  { post: 5, author: 0, content: "데모 계정으로 보면 수정 버튼이 없는 게 맞네요." },
  { post: 5, author: 1, content: "네, 답글은 로그인한 누구나 달 수 있습니다.", parent: 3 },
];

// ---- 실행 ----

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
ensureSchema(db);

function countRows(table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}

function clearTable(table: string) {
  db.exec(`DELETE FROM ${table}`);
  db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table); // id 를 1부터 다시
}

if (reset) {
  // 외래키 순서를 고려해 자식 테이블부터 비운다
  for (const t of ["comments", "posts", "todos", "users"]) clearTable(t);
  console.log("모든 테이블을 비웠습니다.");
}

// 테이블에 데이터가 있으면 건너뛰고, 없으면 rows 를 넣는다. 삽입된 id 목록을 돌려준다.
function seedTable(table: string, insertSql: string, rows: (string | number | null)[][]): number[] {
  const count = countRows(table);
  if (count > 0) {
    console.log(`${table}: 이미 ${count}건이 있어 건너뜁니다. (--reset 으로 초기화 가능)`);
    return [];
  }
  const ids: number[] = [];
  db.exec("BEGIN"); // 여러 건을 하나의 트랜잭션으로. 중간에 실패하면 전부 되돌린다
  try {
    const insert = db.prepare(insertSql);
    for (const row of rows) ids.push(Number(insert.run(...row).lastInsertRowid));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  console.log(`${table}: 샘플 ${rows.length}건 삽입`);
  return ids;
}

// users (비밀번호는 해시해서 저장)
const userRows = await Promise.all(
  SEED_USERS.map(async (u) => [u.email, u.name, await hashPassword(u.password)]),
);
let userIds = seedTable("users", "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)", userRows);
if (userIds.length === 0) {
  // 이미 있던 사용자 id 를 이메일로 찾아 둔다 (posts/comments 연결용)
  userIds = SEED_USERS.map((u) => {
    const row = db.prepare("SELECT id FROM users WHERE email = ?").get(u.email) as { id: number } | undefined;
    return row?.id ?? 0;
  });
}

seedTable(
  "todos",
  "INSERT INTO todos (title, completed) VALUES (?, ?)",
  SEED_TODOS.map((t) => [t.title, t.completed ? 1 : 0]),
);

const postIds = seedTable(
  "posts",
  "INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)",
  SEED_POSTS.map((p) => [p.title, p.content, userIds[p.author] || null]),
);

if (postIds.length > 0 && countRows("comments") === 0) {
  // 답글은 부모 댓글의 실제 id 가 필요하므로 순서대로 하나씩 넣는다
  const insert = db.prepare(
    "INSERT INTO comments (post_id, parent_id, author_id, content) VALUES (?, ?, ?, ?)",
  );
  const commentIds: number[] = [];
  db.exec("BEGIN");
  try {
    for (const c of SEED_COMMENTS) {
      const parentId = c.parent === undefined ? null : commentIds[c.parent];
      const r = insert.run(postIds[c.post], parentId, userIds[c.author], c.content);
      commentIds.push(Number(r.lastInsertRowid));
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  console.log(`comments: 샘플 ${SEED_COMMENTS.length}건 삽입`);
} else if (postIds.length === 0) {
  console.log("comments: posts 를 새로 넣지 않았으므로 건너뜁니다.");
}

console.log(`완료: ${DB_PATH}`);
db.close();
