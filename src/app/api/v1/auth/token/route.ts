// POST /api/v1/auth/token — 이메일 + 비밀번호로 액세스 토큰 발급 (로그인)
//
// 액세스 토큰은 1시간짜리다. 오래 쓸 자격증명이 필요하면 이 토큰으로 API 키를 발급받는다
// (POST /api/v1/auth/keys). 짧은 토큰과 폐기 가능한 키를 나누는 이유는 README 의 Part 5 참고.
import { ACCESS_TOKEN_TTL_SECONDS, issueAccessToken } from "@/lib/api/auth";
import { ok, parseJsonBody, unauthorized } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { serializeUser } from "@/lib/api/serialize";
import { verifyPassword } from "@/lib/password";
import { tokenSchema } from "@/lib/schemas/api";
import { findUserWithHashByEmail } from "@/lib/users";

export const POST = apiRoute(async ({ request }) => {
  const { email, password } = await parseJsonBody(request, tokenSchema);

  const found = findUserWithHashByEmail(email);
  const passwordMatches = found ? await verifyPassword(password, found.password_hash) : false;

  // 이메일이 없을 때와 비밀번호가 틀렸을 때 같은 메시지를 준다.
  // 구분해서 알려 주면 "가입된 이메일 목록" 을 만드는 데 쓸 수 있다 (계정 열거).
  if (!found || !passwordMatches) throw unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");

  return ok({
    accessToken: await issueAccessToken(found.id),
    tokenType: "Bearer",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS, // 초 단위. 클라이언트가 만료 전에 갱신할 수 있게
    user: serializeUser({ id: found.id, name: found.name, email: found.email }),
  });
});
