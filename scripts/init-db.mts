/**
 * DB 파일 및 테이블을 초기화하는 스크립트. 앱과 무관하게 터미널에서 실행한다.
 *   npm run db:init
 * (src/lib/db.ts 가 첫 연결 시 테이블을 자동 생성하므로 필수는 아니고, 미리 만들어 두고 싶을 때 사용)
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { ensureSchema } from "../src/lib/schema.ts";

const DB_PATH = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "data/app.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
ensureSchema(db);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all() as { name: string }[];

console.log(`DB 초기화 완료: ${DB_PATH}`);
console.log(`테이블: ${tables.map((t) => t.name).join(", ")}`);
db.close();
