// GET /api/v1/auth/me — 토큰의 주인이 누구인지 확인
//
// 외부 개발자가 가장 먼저 호출해 보는 엔드포인트다. 여기서 200 이 나오면
// "자격증명이 제대로 전달되고 있다" 는 것이 확인되므로 나머지 디버깅이 쉬워진다.
import { requireAuth } from "@/lib/api/auth";
import { ok } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { serializeUser } from "@/lib/api/serialize";

export const GET = apiRoute(async ({ auth }) => {
  const { user, via } = requireAuth(auth);
  // via: 이번 요청이 액세스 토큰으로 왔는지 API 키로 왔는지. 통합 디버깅에 유용하다.
  return ok({ user: serializeUser(user), via });
});
