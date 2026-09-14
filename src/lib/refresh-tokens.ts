// refresh_tokens 테이블 접근 함수 (Prisma 버전). 공개 API 의 리프레시 토큰을 다룬다.
// main 브랜치와 함수 이름·반환 타입은 같고, 구현만 SQL 문자열 → Prisma 쿼리로 바뀌었다. 모든 함수가 async 가 된 것이 가장 큰 차이다.
//
// 액세스 토큰(JWT, 1시간)은 서버에 저장하지 않으므로 만료 전에는 거둬들일 수 없고, 만료 뒤에는 다시 로그인해야 한다.
// 매번 비밀번호를 묻는 대신, 로그인 때 리프레시 토큰을 함께 주고 그걸로 새 액세스 토큰을 받게 한다 (POST /api/v1/auth/refresh).
// 리프레시 토큰은 오래 살기 때문에(30일) 유출되면 피해가 크다. 그래서 세 가지 장치를 둔다.
//
//  1. 서버 측 저장소  행이 있어야 유효하다 → 로그아웃이나 재사용 감지 때 즉시 무효화할 수 있다 (stateless JWT 로는 불가능).
//                    원문은 저장하지 않고 SHA-256 해시만 넣는다 (API 키와 같은 원칙. api-keys.ts 의 설명 참고).
//  2. 회전(rotation) 갱신할 때마다 새 토큰을 주고 옛 토큰은 used_at 을 채워 "소비" 한다. 토큰 하나는 딱 한 번만 쓰인다.
//                    탈취된 토큰이 있어도 정상 사용자가 먼저 갱신했다면 그 토큰은 이미 죽어 있다.
//  3. 재사용 감지     이미 소비된 토큰이 다시 오면 "탈취" 신호로 본다. 정상 클라이언트는 새 토큰을 받았으니 옛 것을 다시 쓸 이유가 없다.
//                    공격자와 정상 사용자 중 누가 먼저 썼는지는 알 수 없으므로, 같은 가족(family)의 토큰을 전부 폐기해 둘 다 다시 로그인하게 만든다.
//
// 가족(family): 로그인 한 번 = 가족 하나. 회전으로 만들어진 새 토큰은 같은 family_id 와 같은 expires_at 을 물려받는다.
// 그래서 가족의 수명은 로그인 시점부터 30일로 고정된다(절대 수명). 갱신할 때마다 30일을 새로 주는 방식(sliding)도 흔하지만,
// 그러면 한 번 로그인한 세션이 영원히 살 수 있다. 여기서는 "최소 30일에 한 번은 비밀번호를 다시 확인한다" 를 택했다.
import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sqlNow } from "@/lib/sql-now";
import { log } from "@/lib/study-log";

/** 토큰 앞에 붙는 고정 접두사. 문자열만 보고 "이건 리프레시 토큰" 이라고 구분한다 (API 키의 sk_ 와 같은 역할). */
export const REFRESH_TOKEN_PREFIX = "rt_";

/** 가족의 절대 수명(초). 로그인 후 이 시간이 지나면 회전을 아무리 해도 만료된다. */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** 발급 결과. token 이 클라이언트에게 딱 한 번 주는 원문이다. */
export type IssuedRefreshToken = { token: string; familyId: string; expiresAt: Date };

/** 회전 결과. 실패 이유를 나눠서 돌려주면 라우트가 "재사용" 만 다른 에러 코드로 바꿀 수 있다. */
export type RotateResult =
  | { ok: true; userId: number; next: IssuedRefreshToken }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "reused" };

/**
 * prisma 와 $transaction 콜백의 tx 를 둘 다 받기 위한 타입.
 * 트랜잭션 안에서는 prisma 대신 tx 로 쿼리해야 같은 트랜잭션에 묶인다 (prisma 를 쓰면 트랜잭션 밖에서 실행된다).
 */
type Db = Prisma.TransactionClient;

/** 토큰 원문 → 조회에 쓰는 해시. 같은 입력이면 항상 같은 결과라서 WHERE token_hash = ? 로 찾을 수 있다. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// 날짜는 다른 테이블과 같은 형식("YYYY-MM-DD HH:MM:SS", UTC)의 TEXT 로 저장한다. 이 형식은 문자열 비교 = 시간 비교라서 SQL 에서 바로 비교할 수 있다.
function toSqlDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
function fromSqlDate(text: string): Date {
  return new Date(`${text.replace(" ", "T")}Z`);
}

/** 가족의 요약. 로그에 전체 UUID 를 찍으면 길어서 앞 8자만 쓴다. */
const short = (familyId: string) => familyId.slice(0, 8);

// main: INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at) VALUES (?, ?, ?, ?)
async function insertToken(db: Db, userId: number, familyId: string, expiresAt: Date): Promise<IssuedRefreshToken> {
  // 32바이트(256비트) 난수. 추측할 수 없으므로 느린 해시(scrypt) 대신 SHA-256 으로 충분하다.
  const token = REFRESH_TOKEN_PREFIX + randomBytes(32).toString("hex");
  const stored = toSqlDate(expiresAt); // DB 는 초 단위. 돌려주는 값도 저장된 값과 똑같이 맞춘다 (회전 때 물려받는 값과 일치)
  await db.refreshToken.create({ data: { userId, familyId, tokenHash: hashRefreshToken(token), expiresAt: stored } });
  return { token, familyId, expiresAt: fromSqlDate(stored) };
}

// main: UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE family_id = ? AND revoked_at IS NULL
async function revokeFamily(db: Db, familyId: string): Promise<number> {
  const result = await db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: sqlNow() } });
  return result.count;
}

/**
 * 만료된 행 정리. 회전할 때마다 행이 하나씩 늘어나므로 안 지우면 테이블이 계속 커진다.
 * 만료된 토큰은 어차피 거부되므로 지워도 동작이 달라지지 않는다. 로그인 때마다 한 번씩 부른다.
 * main: DELETE FROM refresh_tokens WHERE expires_at < ?
 */
async function pruneExpired(): Promise<void> {
  const result = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: sqlNow() } } });
  if (result.count > 0) log.api(`  ↳ 만료된 리프레시 토큰 ${result.count}건 정리`);
}

/**
 * 로그인(비밀번호 확인) 직후 호출. 새 가족을 만들고 첫 토큰을 발급한다.
 * 돌려주는 token 은 응답에 한 번 실리고 끝이다. DB 에는 해시만 있어서 다시 알아낼 방법이 없다.
 */
export async function issueRefreshToken(userId: number): Promise<IssuedRefreshToken> {
  await pruneExpired();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const issued = await insertToken(prisma, userId, randomUUID(), expiresAt);
  log.api(`  ↳ 리프레시 토큰 발급: 새 가족 ${short(issued.familyId)} (userId=${userId}, ${REFRESH_TOKEN_TTL_SECONDS / 86400}일)`);
  return issued;
}

/**
 * 회전. "검사 → 옛 토큰 소비 → 새 토큰 발급" 을 하나의 트랜잭션 안에서 한다.
 * 같은 토큰으로 요청 두 개가 동시에 와도 하나만 성공하고 나머지는 "재사용" 으로 잡힌다.
 *
 * 검사 순서가 중요하다:
 *  - 없음          → invalid. 위조이거나 정리(prune)된 옛 토큰.
 *  - revoked_at    → revoked. 이미 로그아웃했거나 재사용 감지로 죽은 가족.
 *  - used_at       → reused.  ★ 가족 전체를 폐기한다. 만료 검사보다 먼저 한다 — 만료된 토큰이라도 "두 번 쓰였다" 는 사실은 탈취 신호다.
 *  - expires_at    → expired.
 *
 * main 은 BEGIN IMMEDIATE … COMMIT 을 직접 쓴다. Prisma 는 $transaction(async (tx) => …) 이 그 역할을 한다:
 * 콜백이 정상 종료하면 COMMIT, throw 하면 ROLLBACK. 콜백 안의 쿼리는 반드시 tx 로 보내야 한다.
 */
export async function rotateRefreshToken(token: string): Promise<RotateResult> {
  return prisma.$transaction(async (tx): Promise<RotateResult> => {
    const row = await tx.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(token) } });
    if (!row) return { ok: false, reason: "invalid" };
    if (row.revokedAt !== null) return { ok: false, reason: "revoked" };

    if (row.usedAt !== null) {
      const revoked = await revokeFamily(tx, row.familyId);
      log.api(`  ↳ 리프레시 토큰 재사용 감지! 가족 ${short(row.familyId)} 의 토큰 ${revoked}건 폐기 (userId=${row.userId})`);
      return { ok: false, reason: "reused" };
    }

    if (fromSqlDate(row.expiresAt).getTime() <= Date.now()) return { ok: false, reason: "expired" };

    // 옛 토큰을 소비하고, 같은 가족·같은 만료 시각으로 새 토큰을 만든다
    await tx.refreshToken.update({ where: { id: row.id }, data: { usedAt: sqlNow() } });
    const next = await insertToken(tx, row.userId, row.familyId, fromSqlDate(row.expiresAt));
    log.api(`  ↳ 리프레시 토큰 회전: 가족 ${short(row.familyId)} 의 #${row.id} 소비 → 새 토큰 발급 (userId=${row.userId})`);
    return { ok: true, userId: row.userId, next };
  });
}

/**
 * 로그아웃. 토큰이 속한 가족 전체를 폐기한다.
 * 이미 소비됐거나 만료된 토큰이어도 가족은 폐기한다 — "이 로그인 세션을 끝내고 싶다" 는 뜻은 같기 때문이다.
 * 토큰을 찾지 못하면 false. 라우트는 이 값과 무관하게 204 를 준다 (두 번 눌러도 결과가 같아야 한다).
 */
export async function revokeRefreshTokenFamily(token: string): Promise<boolean> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(token) } });
  if (!row) return false;
  const revoked = await revokeFamily(prisma, row.familyId);
  log.api(`  ↳ 로그아웃: 가족 ${short(row.familyId)} 의 토큰 ${revoked}건 폐기 (userId=${row.userId})`);
  return true;
}
