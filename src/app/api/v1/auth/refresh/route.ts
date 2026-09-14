// POST /api/v1/auth/refresh — 리프레시 토큰으로 새 액세스 토큰 + 새 리프레시 토큰 받기 (회전)
//
// 액세스 토큰(1시간)이 만료됐을 때 비밀번호를 다시 묻지 않기 위한 엔드포인트다.
// 본문의 refreshToken 은 이 호출로 "소비" 되어 다시 쓸 수 없고, 응답의 새 refreshToken 으로 갈아 끼워야 한다.
// 소비된 토큰이 다시 오면 탈취로 보고 그 로그인 세션(가족)의 토큰을 전부 폐기한다 — 자세한 이유는 src/lib/refresh-tokens.ts.
//
// 인증 헤더는 필요 없다. 리프레시 토큰 자체가 자격증명이다 (그래서 이 토큰은 액세스 토큰보다 더 조심해서 보관해야 한다).
import { tokenResponse } from "@/lib/api/auth";
import { ok, parseJsonBody, refreshTokenReused, unauthorized } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { rotateRefreshToken } from "@/lib/refresh-tokens";
import { refreshTokenSchema } from "@/lib/schemas/api";
import { findUserById } from "@/lib/users";

export const POST = apiRoute(async ({ request }) => {
  const { refreshToken } = await parseJsonBody(request, refreshTokenSchema);

  const result = await rotateRefreshToken(refreshToken);
  if (!result.ok) {
    // 재사용만 code 를 다르게 준다. 클라이언트는 이 code 를 보면 저장해 둔 토큰을 모두 버리고
    // 사용자에게 "다른 기기에서 로그인이 감지되어 로그아웃되었습니다" 같은 안내를 해야 한다.
    if (result.reason === "reused") {
      throw refreshTokenReused(
        "이미 사용된 리프레시 토큰입니다. 탈취 가능성이 있어 이 로그인 세션의 토큰을 모두 폐기했습니다. 다시 로그인하세요.",
      );
    }
    // 없음·만료·폐기는 구분하지 않는다. 구분해 주면 "이 토큰이 존재했었는지" 를 알려 주는 셈이다.
    throw unauthorized("리프레시 토큰이 유효하지 않거나 만료되었습니다. 다시 로그인하세요.");
  }

  const user = await findUserById(result.userId); // 탈퇴 등으로 사용자가 사라졌을 수 있다
  if (!user) throw unauthorized("토큰에 담긴 사용자를 찾을 수 없습니다.");

  return ok(await tokenResponse(user, result.next));
});
