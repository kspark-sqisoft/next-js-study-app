// users 테이블 접근 함수 (Prisma 버전).
// main 브랜치와 함수 이름·반환 타입은 같고, 구현만 SQL 문자열 → Prisma 쿼리로 바뀌었다.
// 모든 함수가 async 가 된 것이 가장 큰 차이다 (Prisma 는 비동기 API 만 제공한다).
import "server-only";
import { prisma } from "@/lib/prisma";

// 화면/클라이언트로 내보내도 되는 사용자 정보 (DTO). passwordHash 는 절대 포함하지 않는다.
export type User = {
  id: number;
  name: string;
  email: string;
};

type UserRow = User & { password_hash: string; created_at: string };

export async function findUserById(id: number): Promise<User | null> {
  if (!Number.isInteger(id)) return null;
  // select 로 필요한 컬럼만 고른다. 반환 타입이 { id, name, email } 로 자동 추론된다
  return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true } });
}

/** 로그인 검증용. 해시가 포함되어 있으므로 이 결과를 그대로 밖으로 내보내면 안 된다. */
export async function findUserWithHashByEmail(email: string): Promise<UserRow | null> {
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!u) return null;
  // main 브랜치 호출부가 password_hash 이름을 쓰므로 같은 모양으로 맞춘다
  return { id: u.id, name: u.name, email: u.email, password_hash: u.passwordHash, created_at: u.createdAt };
}

export async function createUser(name: string, email: string, passwordHash: string): Promise<User> {
  return prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash },
    select: { id: true, name: true, email: true },
  });
}
