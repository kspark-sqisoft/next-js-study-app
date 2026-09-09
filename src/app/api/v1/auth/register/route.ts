// POST /api/v1/auth/register — 계정 생성
//
// 화면의 회원가입(src/app/(auth)/actions.ts)과 같은 일을 하지만 결과가 다르다.
// 화면은 세션 쿠키를 굽고 /posts 로 리다이렉트하고, API 는 액세스 토큰을 JSON 으로 돌려준다.
// 검증 규칙과 비밀번호 해시 방식은 완전히 같은 코드를 쓴다.
import { ACCESS_TOKEN_TTL_SECONDS, issueAccessToken } from "@/lib/api/auth";
import { conflict, ok, parseJsonBody } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { serializeUser } from "@/lib/api/serialize";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/schemas/api";
import { createUser, findUserWithHashByEmail } from "@/lib/users";

export const POST = apiRoute(async ({ request }) => {
  const { name, email, password } = await parseJsonBody(request, registerSchema);

  // 409 Conflict: 요청 자체는 올바른데 현재 상태와 충돌한다는 뜻.
  // (가입 화면과 달리 여기서는 이메일 존재 여부를 숨기지 않는다. 가입 API 는 어차피
  //  "이 이메일로 가입되나?" 를 시도해 보면 알 수 있어서 감추는 의미가 없다)
  if (findUserWithHashByEmail(email)) throw conflict("이미 가입된 이메일입니다.");

  const user = createUser(name, email, await hashPassword(password));

  return ok(
    {
      user: serializeUser(user),
      accessToken: await issueAccessToken(user.id),
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
    201, // 201 Created: 새 리소스가 만들어졌다
  );
});
