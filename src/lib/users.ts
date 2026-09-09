// users 테이블 접근 함수.
import "server-only";
import { db } from "@/lib/db";

// 화면/클라이언트로 내보내도 되는 사용자 정보 (DTO). password_hash 는 절대 포함하지 않는다.
export type User = {
  id: number;
  name: string;
  email: string;
};

type UserRow = User & { password_hash: string; created_at: string };

export function findUserById(id: number): User | null {
  const row = db
    .prepare("SELECT id, name, email FROM users WHERE id = ?")
    .get(id) as User | undefined;
  return row ?? null;
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
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id, name, email",
    )
    .get(name, email.toLowerCase(), passwordHash) as User;
  return row;
}
