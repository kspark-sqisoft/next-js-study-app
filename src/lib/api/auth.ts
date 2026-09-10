// 공개 API 의 인증. 두 가지 자격증명을 모두 Authorization: Bearer 헤더로 받는다.
//
//   Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...   → 액세스 토큰 (사용자 대신 행동, 1시간)
//   Authorization: Bearer sk_1a2b3c4d...            → API 키 (서버-투-서버, 무기한 + 폐기 가능)
//
// 왜 세션 쿠키를 안 쓰는가:
//  1. 쿠키는 브라우저가 자동으로 붙인다 → 다른 사이트가 사용자를 시켜 요청을 보낼 수 있다(CSRF).
//     Bearer 헤더는 자동으로 붙지 않으므로 CSRF 자체가 성립하지 않는다.
//  2. 쿠키는 도메인에 묶여서 서버-투-서버 호출에 쓰기 어렵다.
//  3. 그래서 이 API 는 쿠키를 아예 보지 않는다. 브라우저에 로그인되어 있어도 /api/v1 은 401 이다.
import "server-only";
import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { API_KEY_PREFIX, findUserIdByApiKey, touchApiKey } from "@/lib/api-keys";
import { forbidden, unauthorized } from "@/lib/api/http";
import { findUserById, type User } from "@/lib/users";

/** 액세스 토큰 유효기간(초). 짧게 두고, 오래 쓸 자격증명이 필요하면 API 키를 발급받게 한다. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

const ISSUER = "next-js-study-app";
const AUDIENCE = "api";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET 환경변수가 없습니다. .env 에 `openssl rand -base64 32` 결과를 넣으세요.");
}

/**
 * 세션 쿠키와 "다른" 서명 키를 쓴다.
 *
 * 같은 키로 서명하면 API 액세스 토큰을 그대로 세션 쿠키에 붙여 넣어도 검증을 통과한다 (토큰 혼동, token confusion).
 * 용도가 다른 토큰은 서로 통용되지 않아야 하므로, SESSION_SECRET 에서 HMAC 으로 파생시킨 별도 키를 만든다.
 * 환경변수는 하나만 관리하면서도 두 토큰이 완전히 분리된다.
 */
const accessTokenKey = new Uint8Array(
  createHmac("sha256", sessionSecret).update("api-access-token-v1").digest(),
);

/** 인증에 성공한 요청의 주체. via 는 어느 자격증명으로 들어왔는지 (로그·디버깅용). */
export type Principal = { user: User; via: "access_token" | "api_key" };

/** 로그인 성공 시 발급. POST /api/v1/auth/token 이 돌려주는 값이다. */
export async function issueAccessToken(userId: number): Promise<string> {
  return new SignJWT({ scope: "api" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId)) // 표준 클레임 sub 에 사용자 id
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessTokenKey);
}

/** 액세스 토큰 검증. 위조·만료·발급자 불일치면 null. */
async function userIdFromAccessToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, accessTokenKey, {
      algorithms: ["HS256"], // 허용 알고리즘을 고정한다 (alg: "none" 같은 공격 방지)
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const userId = Number(payload.sub);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null; // 서명 불일치, 만료 등
  }
}

/** Authorization 헤더에서 Bearer 토큰만 꺼낸다. 헤더가 없으면 null. */
function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") {
    throw unauthorized("Authorization 헤더는 'Bearer <토큰>' 형식이어야 합니다.");
  }
  const token = rest.join(" ").trim();
  if (!token) throw unauthorized("Bearer 토큰이 비어 있습니다.");
  return token;
}

/**
 * 요청을 인증한다.
 * - 헤더가 아예 없으면 null (익명). 공개 읽기 엔드포인트는 이 상태로도 동작한다.
 * - 헤더가 있는데 유효하지 않으면 401 을 던진다. "조용히 익명 취급" 하면
 *   개발자가 토큰이 만료된 줄 모르고 빈 결과만 보게 되므로 더 나쁘다.
 */
export async function authenticate(request: Request): Promise<Principal | null> {
  const token = bearerToken(request);
  if (token === null) return null;

  const isApiKey = token.startsWith(API_KEY_PREFIX);
  const userId = isApiKey ? await findUserIdByApiKey(token) : await userIdFromAccessToken(token);
  if (userId === null) {
    throw unauthorized(isApiKey ? "폐기되었거나 존재하지 않는 API 키입니다." : "토큰이 유효하지 않거나 만료되었습니다.");
  }

  const user = await findUserById(userId); // 탈퇴 등으로 사용자가 사라졌을 수 있다
  if (!user) throw unauthorized("토큰에 담긴 사용자를 찾을 수 없습니다.");

  if (isApiKey) await touchApiKey(token); // 마지막 사용 시각 기록
  return { user, via: isApiKey ? "api_key" : "access_token" };
}

/** 로그인이 반드시 필요한 엔드포인트에서 사용. */
export function requireAuth(auth: Principal | null): Principal {
  if (!auth) throw unauthorized();
  return auth;
}

/**
 * 액세스 토큰으로만 허용하는 엔드포인트에서 사용 (API 키 발급/폐기).
 *
 * API 키로 또 다른 API 키를 만들 수 있으면, 키 하나가 유출됐을 때 공격자가 스스로 키를
 * 계속 찍어낼 수 있어 폐기가 의미를 잃는다. 자격증명이 자기 자신을 복제하지 못하게 막는다.
 */
export function requireAccessToken(auth: Principal | null): Principal {
  const principal = requireAuth(auth);
  if (principal.via !== "access_token") {
    throw forbidden("API 키 관리는 액세스 토큰으로만 가능합니다. POST /api/v1/auth/token 으로 토큰을 발급받으세요.");
  }
  return principal;
}

/**
 * 레이트 리밋 기준으로 쓸 클라이언트 IP.
 * 프록시/로드밸런서 뒤에 있으면 실제 IP 는 X-Forwarded-For 첫 번째 값이다.
 * (이 헤더는 클라이언트가 위조할 수 있으므로, 실제 서비스에서는 신뢰하는 프록시가 덮어쓰도록 설정해야 한다)
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
