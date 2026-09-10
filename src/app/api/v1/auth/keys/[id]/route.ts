// DELETE /api/v1/auth/keys/:id — API 키 폐기
//
// 행을 지우지 않고 revoked_at 만 채운다. "언제 어떤 키가 쓰였는지" 이력이 남아야
// 유출 사고가 났을 때 무엇이 노출됐는지 추적할 수 있다.
import { noContent, notFound, parseIdParam } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { requireAccessToken } from "@/lib/api/auth";
import { revokeApiKey } from "@/lib/api-keys";

export const DELETE = apiRoute<{ id: string }>(async ({ params, auth }) => {
  const { user } = requireAccessToken(auth);
  const id = parseIdParam(params.id);

  // revokeApiKey 의 SQL 에 user_id 조건이 들어 있다. 남의 키 id 를 넣어도 0건이 바뀌므로
  // "없음" 과 "남의 것" 이 같은 404 가 된다 — 남의 키 존재 여부를 알려 주지 않는다.
  if (!await revokeApiKey(user.id, id)) throw notFound("존재하지 않거나 이미 폐기된 키입니다.");

  return noContent(); // 204: 성공했고 돌려줄 본문이 없다
});
