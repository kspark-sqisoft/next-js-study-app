// DB 스키마 정의와 "수동 마이그레이션".
// 앱(src/lib/db.ts)과 스크립트(scripts/*.mts) 가 같은 정의를 쓰도록 한 곳에 모았다.
// 마이그레이션 도구(Prisma, Drizzle 등) 없이 SQLite 를 쓸 때는 이렇게 직접 관리한다.
// 이 파일은 Next.js 밖(node 스크립트)에서도 import 되므로 "server-only" 를 붙이지 않는다.
import type { DatabaseSync } from "node:sqlite";

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,            -- 비밀번호 원문은 절대 저장하지 않는다
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,     -- SQLite 는 boolean 이 없어 0/1 로 저장
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    author_id  INTEGER REFERENCES users(id),   -- NULL 이면 작성자 없음(초기 샘플 등)
    image_path TEXT,                            -- 첨부 이미지 파일명 (data/uploads/ 안). NULL 이면 없음
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,  -- NULL 이면 최상위 댓글, 값이 있으면 답글
    author_id  INTEGER NOT NULL REFERENCES users(id),
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

  -- 외부 개발자용 API 키. 공개 API(/api/v1)에서 Authorization: Bearer <키> 로 쓴다.
  CREATE TABLE IF NOT EXISTS api_keys (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,            -- "내 블로그 봇" 같은 사람이 붙이는 이름
    key_hash     TEXT    NOT NULL UNIQUE,     -- 키 원문은 저장하지 않는다. SHA-256 해시만 (비밀번호와 같은 원칙)
    prefix       TEXT    NOT NULL,            -- 목록에서 어떤 키인지 알아보기 위한 앞부분 (sk_1a2b3c4d)
    last_used_at TEXT,                        -- 마지막 사용 시각. 안 쓰는 키를 찾는 용도
    revoked_at   TEXT,                        -- 폐기 시각. NULL 이 아니면 인증 거부 (행은 남겨서 이력 유지)
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
`;

/**
 * 테이블을 만들고, 이미 있는 테이블에 빠진 컬럼이 있으면 추가한다.
 * CREATE TABLE IF NOT EXISTS 는 "이미 있는 테이블" 을 건드리지 않으므로,
 * 나중에 추가된 컬럼(posts.author_id 등)은 이렇게 따로 처리해야 한다.
 */
export function ensureSchema(db: DatabaseSync): void {
  db.exec(SCHEMA);

  // 나중에 추가된 컬럼들. 순서대로 누적된다 (간단한 마이그레이션 이력 역할)
  if (!hasColumn(db, "posts", "author_id")) {
    db.exec("ALTER TABLE posts ADD COLUMN author_id INTEGER REFERENCES users(id)");
  }
  if (!hasColumn(db, "posts", "image_path")) {
    db.exec("ALTER TABLE posts ADD COLUMN image_path TEXT");
  }
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}
