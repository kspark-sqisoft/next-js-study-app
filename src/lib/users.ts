// users 테이블 접근 함수 (Prisma 버전).
// main 브랜치와 함수 이름·반환 타입은 같고, 구현만 SQL 문자열 → Prisma 쿼리로 바뀌었다.
// 모든 함수가 async 가 된 것이 가장 큰 차이다 (Prisma 는 비동기 API 만 제공한다).
//
// 읽는 법: 각 함수 위에 main 의 SQL 을 주석으로 남겨 두었다. 같은 일을 하는 두 표현을 나란히 보자.
import "server-only";
import { prisma } from "@/lib/prisma";

// 화면/클라이언트로 내보내도 되는 사용자 정보 (DTO). passwordHash 는 절대 포함하지 않는다.
export type User = {
  id: number;
  name: string;
  email: string;
};

// 로그인 검증에만 쓰는 모양. main 의 DB 행 이름(snake_case)을 그대로 유지해 호출부를 안 고쳐도 되게 했다.
type UserRow = User & { password_hash: string; created_at: string };

// main: SELECT id, name, email FROM users WHERE id = ?
export async function findUserById(id: number): Promise<User | null> {
  if (!Number.isInteger(id)) return null; // NaN 등은 Prisma 가 "id 가 없다" 며 거부한다. SQLite 는 빈 결과였으므로 맞춘다
  // findUnique: 유니크 컬럼(id, email)으로 한 건. select 로 필요한 컬럼만 고르면 반환 타입이 { id, name, email } 로 추론된다
  return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true } });
}

/**
 * 로그인 검증용. 해시가 포함되어 있으므로 이 결과를 그대로 밖으로 내보내면 안 된다.
 * main: SELECT * FROM users WHERE email = ?
 */
export async function findUserWithHashByEmail(email: string): Promise<UserRow | null> {
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } }); // 이메일은 소문자로 저장·조회
  if (!u) return null;
  // Prisma 는 camelCase(passwordHash)로 돌려준다. main 호출부는 password_hash 를 기대하므로 같은 모양으로 맞춘다.
  return { id: u.id, name: u.name, email: u.email, password_hash: u.passwordHash, created_at: u.createdAt };
}

// main: INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id, name, email
export async function createUser(name: string, email: string, passwordHash: string): Promise<User> {
  // create 는 만든 행을 돌려준다 (SQL 의 RETURNING 과 같다). select 로 비밀번호 해시는 빼고 받는다.
  return prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash },
    select: { id: true, name: true, email: true },
  });
}
