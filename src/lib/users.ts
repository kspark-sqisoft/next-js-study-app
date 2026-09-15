// users 테이블 접근 함수.
import "server-only";
import { db } from "@/lib/db";

// 화면/클라이언트로 내보내도 되는 사용자 정보 (DTO). password_hash 는 절대 포함하지 않는다.
export type User = {
  id: number;
  name: string;
  email: string;
  avatarPath: string | null; // 아바타 파일명 (data/uploads/). 화면에서는 /api/uploads/<파일명>
};

// DB 행 (snake_case). 로그인 검증에만 쓰이며, 해시가 들어 있어 밖으로 내보내면 안 된다.
type UserRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  avatar_path: string | null;
  created_at: string;
};

// 화면용 컬럼만 고른 행. 해시는 애초에 조회하지 않는다.
type UserLiteRow = Pick<UserRow, "id" | "name" | "email" | "avatar_path">;

const SELECT_USER = "SELECT id, name, email, avatar_path FROM users";

function toUser(row: UserLiteRow): User {
  return { id: row.id, name: row.name, email: row.email, avatarPath: row.avatar_path };
}

export function findUserById(id: number): User | null {
  const row = db.prepare(`${SELECT_USER} WHERE id = ?`).get(id) as UserLiteRow | undefined;
  return row ? toUser(row) : null;
}

/** 로그인 검증용. 해시가 포함되어 있으므로 이 결과를 그대로 밖으로 내보내면 안 된다. */
export function findUserWithHashByEmail(email: string): UserRow | null {
  const row = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase()) as UserRow | undefined;
  return row ?? null;
}

export function createUser(name: string, email: string, passwordHash: string): User {
  const row = db
    .prepare(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id, name, email, avatar_path",
    )
    .get(name, email.toLowerCase(), passwordHash) as UserLiteRow;
  return toUser(row);
}

/** 프로필 수정 (이름, 아바타). 권한 검사(본인인지)는 호출하는 Server Action 이 한다. */
export function updateUserProfile(id: number, data: { name: string; avatarPath: string | null }): User | null {
  db.prepare("UPDATE users SET name = ?, avatar_path = ? WHERE id = ?").run(data.name, data.avatarPath, id);
  return findUserById(id);
}
