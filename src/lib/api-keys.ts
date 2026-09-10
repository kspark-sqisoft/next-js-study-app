// api_keys 테이블 접근 함수. 외부 개발자용 장기 자격증명(API 키)을 다룬다.
//
// 저장 원칙은 비밀번호와 같다: 원문은 절대 저장하지 않고 해시만 저장한다.
// 다만 해시 함수는 다르다.
// - 비밀번호(password.ts): scrypt. 사람이 만든 짧고 추측 가능한 문자열이라 "느린" 해시가 필요하다.
// - API 키(여기):          SHA-256. 서버가 만든 256비트 난수라 무차별 대입이 불가능하고,
//                          매 요청마다 "해시로 행을 찾아야" 하므로 빠른 해시여야 한다.
//                          (scrypt 는 salt 가 행마다 달라서 전체 행을 훑지 않으면 조회할 수 없다)
import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sqlNow } from "@/lib/sql-now";

/** 키 앞에 붙는 고정 접두사. 토큰 문자열만 보고 "이건 API 키" 라고 구분할 수 있게 한다. */
export const API_KEY_PREFIX = "sk_";

/** 목록 화면에 보여줄 키 정보. 원문 키는 발급 순간 말고는 어디에도 없다. */
export type ApiKey = {
  id: number;
  name: string;
  prefix: string; // sk_1a2b3c4d — 어떤 키인지 알아보는 용도
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type ApiKeyRecord = {
  id: number;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function toApiKey(k: ApiKeyRecord): ApiKey {
  return { id: k.id, name: k.name, prefix: k.prefix, lastUsedAt: k.lastUsedAt, revokedAt: k.revokedAt, createdAt: k.createdAt };
}

/** 키 원문 → 조회에 쓰는 해시. 같은 입력이면 항상 같은 결과라서 WHERE key_hash = ? 로 찾을 수 있다. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * 새 키 발급. 돌려주는 `key` 가 사용자에게 딱 한 번 보여줄 원문이다.
 * DB 에는 해시만 들어가므로 이 값을 잃어버리면 다시 볼 방법이 없다 (GitHub, Stripe 등과 같은 방식).
 */
export async function createApiKey(userId: number, name: string): Promise<{ apiKey: ApiKey; key: string }> {
  const key = API_KEY_PREFIX + randomBytes(32).toString("hex");
  const prefix = key.slice(0, API_KEY_PREFIX.length + 8); // sk_ + 8자

  const row = await prisma.apiKey.create({ data: { userId, name, keyHash: hashApiKey(key), prefix } });
  return { apiKey: toApiKey(row), key };
}

/** 사용자의 키 목록. 폐기된 것도 이력으로 함께 보여준다. */
export async function listApiKeys(userId: number): Promise<ApiKey[]> {
  const rows = await prisma.apiKey.findMany({ where: { userId }, orderBy: { id: "desc" } });
  return rows.map(toApiKey);
}

/**
 * 요청에 담겨 온 키로 소유자 id 를 찾는다. 없거나 폐기됐으면 null.
 *
 * 해시로 한 행을 찾은 뒤 timingSafeEqual 로 한 번 더 비교한다.
 * SQL 비교만으로도 충분하지만, 비교 시간이 값에 따라 달라지지 않게 하는 습관을 그대로 지킨다.
 */
export async function findUserIdByApiKey(key: string): Promise<number | null> {
  const hash = hashApiKey(key);
  const row = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
  if (!row || row.revokedAt !== null) return null;

  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(row.keyHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return row.userId;
}

/** 마지막 사용 시각 기록. 인증에 성공할 때마다 호출한다 (실패해도 요청은 계속 처리되어야 하므로 반환값 없음). */
export async function touchApiKey(key: string): Promise<void> {
  await prisma.apiKey.updateMany({ where: { keyHash: hashApiKey(key) }, data: { lastUsedAt: sqlNow() } });
}

/**
 * 키 폐기. 행을 지우지 않고 revoked_at 만 채운다.
 * "언제 어떤 키가 쓰였는지" 이력이 남아야 사고 조사가 가능하기 때문이다.
 * 본인 키만 폐기할 수 있도록 user_id 조건을 SQL 에 함께 넣는다.
 */
export async function revokeApiKey(userId: number, id: number): Promise<boolean> {
  const r = await prisma.apiKey.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: sqlNow() } });
  return r.count > 0;
}
