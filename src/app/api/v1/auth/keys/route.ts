// GET  /api/v1/auth/keys — 내 API 키 목록
// POST /api/v1/auth/keys — 새 API 키 발급
//
// 키 관리는 액세스 토큰(= 비밀번호로 방금 로그인한 사람)으로만 할 수 있다.
// 이유는 requireAccessToken() 주석 참고 (src/lib/api/auth.ts).
import { requireAccessToken } from "@/lib/api/auth";
import { ok, okList, paginationOf, parseJsonBody } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { serializeApiKey } from "@/lib/api/serialize";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { apiKeyCreateSchema } from "@/lib/schemas/api";

export const GET = apiRoute(async ({ auth }) => {
  const { user } = requireAccessToken(auth);
  const keys = (await listApiKeys(user.id)).map(serializeApiKey);
  // 키는 보통 몇 개뿐이라 페이지네이션 없이 전부 준다.
  // 그래도 응답 모양은 다른 목록 API 와 같게 맞춘다 (클라이언트가 분기하지 않도록).
  return okList(keys, paginationOf(keys.length, keys.length, 0, keys.length));
});

export const POST = apiRoute(async ({ request, auth }) => {
  const { user } = requireAccessToken(auth);
  const { name } = await parseJsonBody(request, apiKeyCreateSchema);

  const { apiKey, key } = await createApiKey(user.id, name);

  return ok(
    {
      ...serializeApiKey(apiKey),
      // 원문 키는 DB 에 없다(해시만 저장). 이 응답이 키를 볼 수 있는 처음이자 마지막 기회다.
      key,
      warning: "key 값은 다시 볼 수 없습니다. 지금 안전한 곳에 저장하세요.",
    },
    201,
  );
});
