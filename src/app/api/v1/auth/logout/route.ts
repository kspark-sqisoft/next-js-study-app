// POST /api/v1/auth/logout — 리프레시 토큰 폐기 (로그아웃)
//
// 토큰이 속한 가족(로그인 세션) 전체를 폐기한다. 이후 그 가족의 어떤 토큰으로도 갱신할 수 없다.
//
// 주의: 이미 발급된 액세스 토큰은 stateless(JWT) 라서 이 호출로 무효화되지 않고 남은 시간(최대 1시간) 동안 계속 유효하다.
// "로그아웃 즉시 모든 요청 차단" 이 필요하면 액세스 토큰도 저장소에 두거나(= stateless 를 포기) 수명을 몇 분으로 줄여야 한다.
// 이 프로젝트는 "액세스 토큰은 짧게, 긴 것(리프레시 토큰)만 서버가 관리" 라는 흔한 절충을 택했다.
//
// 인증 헤더는 필요 없다. 리프레시 토큰 자체가 자격증명이다.
import { noContent, parseJsonBody } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { revokeRefreshTokenFamily } from "@/lib/refresh-tokens";
import { refreshTokenSchema } from "@/lib/schemas/api";

export const POST = apiRoute(async ({ request }) => {
  const { refreshToken } = await parseJsonBody(request, refreshTokenSchema);

  // 찾지 못해도(이미 폐기됐거나 위조) 204. 로그아웃은 두 번 눌러도 결과가 같아야 하고(멱등),
  // 404 를 주면 "이 토큰이 존재했었는지" 를 알려 주는 셈이 된다.
  revokeRefreshTokenFamily(refreshToken);
  return noContent();
});
