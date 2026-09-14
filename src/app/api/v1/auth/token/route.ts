// POST /api/v1/auth/token — 이메일 + 비밀번호로 액세스 토큰 + 리프레시 토큰 발급 (로그인)
//
// 액세스 토큰은 1시간짜리다. 만료되면 함께 받은 리프레시 토큰으로 새 쌍을 받는다 (POST /api/v1/auth/refresh).
// 봇·서버처럼 사람이 없는 곳에서 오래 쓸 자격증명이 필요하면 액세스 토큰으로 API 키를 발급받는다 (POST /api/v1/auth/keys).
// 짧은 토큰 / 회전하는 리프레시 토큰 / 폐기 가능한 키를 나누는 이유는 README 의 Part 5-4 참고.
import { tokenResponse } from "@/lib/api/auth";
import { ok, parseJsonBody, unauthorized } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { verifyPassword } from "@/lib/password";
import { issueRefreshToken } from "@/lib/refresh-tokens";
import { tokenSchema } from "@/lib/schemas/api";
import { findUserWithHashByEmail } from "@/lib/users";

export const POST = apiRoute(async ({ request }) => {
  const { email, password } = await parseJsonBody(request, tokenSchema);

  const found = await findUserWithHashByEmail(email);
  const passwordMatches = found ? await verifyPassword(password, found.password_hash) : false;

  // 이메일이 없을 때와 비밀번호가 틀렸을 때 같은 메시지를 준다.
  // 구분해서 알려 주면 "가입된 이메일 목록" 을 만드는 데 쓸 수 있다 (계정 열거).
  if (!found || !passwordMatches) throw unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");

  // 비밀번호를 확인한 이 순간이 리프레시 토큰 "가족" 의 시작점이다. 가족의 절대 수명(30일)은 여기서부터 센다.
  const refresh = await issueRefreshToken(found.id);
  return ok(await tokenResponse({ id: found.id, name: found.name, email: found.email }, refresh));
});
