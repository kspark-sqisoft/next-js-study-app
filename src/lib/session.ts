// 세션 관리 (stateless 방식).
// 로그인 정보를 서버 DB 가 아니라 "서명된 JWT 를 담은 쿠키" 로 브라우저에 보관한다.
// 서명 덕분에 브라우저가 내용을 바꾸면 검증에 실패한다. 서명 키(SESSION_SECRET)는 서버만 안다.
import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "session";
const SESSION_DAYS = 7;

const secret = process.env.SESSION_SECRET;
if (!secret) {
  throw new Error(
    "SESSION_SECRET 환경변수가 없습니다. .env 에 `openssl rand -base64 32` 결과를 넣으세요.",
  );
}
const encodedKey = new TextEncoder().encode(secret);

// JWT 에 담는 내용. 최소한만 넣는다 (id 정도). 이메일, 비밀번호 같은 것은 넣지 않는다.
export type SessionPayload = JWTPayload & { userId: number };

/** 페이로드를 서명해 JWT 문자열로 만든다 */
async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(encodedKey);
}

/** JWT 를 검증해 페이로드를 꺼낸다. 위조되었거나 만료되었으면 null */
export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null; // 서명 불일치, 만료 등
  }
}

/** 로그인 성공 시 호출. 세션 쿠키를 만든다. 반드시 서버에서만 설정한다. */
export async function createSession(userId: number): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await encrypt({ userId });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true, // JS(document.cookie)로 읽을 수 없다 → XSS 로 탈취 방지
    secure: process.env.NODE_ENV === "production", // 프로덕션에서는 https 에서만 전송
    sameSite: "lax", // 다른 사이트에서 보내는 요청에는 잘 안 붙는다 → CSRF 완화
    expires: expiresAt,
    path: "/",
  });
}

/** 로그아웃. 쿠키를 지운다. */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** 현재 요청의 쿠키에서 userId 를 꺼낸다. 로그인 안 했으면 null */
export async function getSessionUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const session = await decrypt(cookieStore.get(COOKIE_NAME)?.value);
  return session?.userId ?? null;
}
