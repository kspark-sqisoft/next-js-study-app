// 서버 전용 모듈 표시. 클라이언트 컴포넌트에서 import 하면 빌드 에러가 난다.
import "server-only";
// Node.js 내장 SQLite 드라이버 (Node 22.5+). 별도 npm 패키지 불필요.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { ensureSchema } from "@/lib/schema";

/**
 * SQLite 연결 객체를 만들고 앱 전체에서 하나만 공유하는 모듈.
 *
 * - DB 파일 위치: .env 의 DATABASE_PATH (기본 data/app.db)
 * - 개발 모드 HMR 시 연결이 중복 생성되지 않도록 globalThis 에 캐시
 * - 서버 컴포넌트 / Route Handler / Server Action 에서만 import 하세요
 * - 테이블 정의는 src/lib/schema.ts 에 있다
 *
 * 사용 예:
 *   import { db } from "@/lib/db";
 *   const rows = db.prepare("SELECT * FROM todos").all();
 */

// DB 파일 경로. .env 의 DATABASE_PATH 를 읽는다 (Next.js 가 .env 파일을 자동 로드).
// 상대 경로면 프로젝트 루트 기준으로 해석한다.
// turbopackIgnore: 경로가 환경변수라서 정적으로 알 수 없다. 이 주석이 없으면 Turbopack 이
// "어떤 파일이든 읽을 수 있다" 고 보고 프로젝트 전체를 서버 번들에 포함시키려 한다.
const DB_PATH = path.resolve(/* turbopackIgnore: true */
  process.cwd(),
  process.env.DATABASE_PATH ?? "data/app.db", // .env 의 값이 없으면 기본 경로 사용
);

// DB 연결을 여는 함수. 파일/테이블이 없으면 만들고, 있으면 그대로 열어 연결만 돌려준다.
// 앱 수명 동안 한 번만 호출된다.
function openDatabase(): DatabaseSync {
  // data/ 폴더가 없으면 생성
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const database = new DatabaseSync(DB_PATH);
  database.exec("PRAGMA journal_mode = WAL;"); // 읽기/쓰기 동시성 향상
  database.exec("PRAGMA foreign_keys = ON;"); // 외래키 제약 활성화 (댓글 ON DELETE CASCADE 등)
  ensureSchema(database); // 테이블이 없으면 생성, 빠진 컬럼이 있으면 추가

  return database;
}

// 개발 모드에서는 파일이 저장될 때마다 모듈이 다시 로드되므로
// 연결을 globalThis 에 저장해 두고 재사용한다.
const globalForDb = globalThis as unknown as { __db?: DatabaseSync };

// 이미 만들어진 연결이 있으면 재사용, 없으면 새로 생성
export const db: DatabaseSync = globalForDb.__db ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__db = db;
}
