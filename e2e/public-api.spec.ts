// 공개 API(/api/v1) E2E.
//
// 단위 테스트(src/app/api/v1/**)는 핸들러 함수를 직접 부르므로 proxy 를 거치지 않는다.
// 여기서는 진짜 서버에 HTTP 요청을 보내므로 CORS 프리플라이트, 정적으로 미리 만들어진 라우트,
// 캐시 무효화가 화면까지 반영되는지 같은 "합쳐졌을 때만 알 수 있는 것" 을 확인한다.
import { expect, test } from "@playwright/test";

const V1 = "/api/v1";
const DEMO = { email: "demo@example.com", password: "password123" };

/** 시드 계정으로 액세스 토큰을 받는다. */
async function getToken(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post(`${V1}/auth/token`, { data: DEMO });
  expect(res.status()).toBe(200);
  return (await res.json()).data.accessToken as string;
}

test("진입점과 OpenAPI 명세는 인증 없이 열린다", async ({ request }) => {
  const index = await request.get(V1);
  expect(index.status()).toBe(200);
  expect((await index.json()).documentation).toBe("/api/v1/openapi.json");

  const spec = await request.get(`${V1}/openapi.json`);
  expect(spec.status()).toBe(200);
  const doc = await spec.json();
  expect(doc.openapi).toBe("3.1.0");
  // 명세에 실제 엔드포인트가 모두 들어 있는지
  expect(Object.keys(doc.paths)).toEqual(
    expect.arrayContaining(["/posts", "/posts/{id}", "/todos", "/auth/token", "/auth/keys"]),
  );
});

test("CORS: 프리플라이트에 응답하고 레이트 리밋 헤더를 노출한다", async ({ request }) => {
  const preflight = await request.fetch(`${V1}/posts`, {
    method: "OPTIONS",
    headers: { Origin: "https://example.com", "Access-Control-Request-Method": "POST" },
  });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()["access-control-allow-origin"]).toBe("*");
  expect(preflight.headers()["access-control-allow-methods"]).toContain("PATCH");

  const get = await request.get(`${V1}/posts?limit=1`);
  expect(get.headers()["access-control-allow-origin"]).toBe("*");
  expect(get.headers()["access-control-expose-headers"]).toContain("X-RateLimit-Remaining");
  expect(Number(get.headers()["x-ratelimit-remaining"])).toBeGreaterThanOrEqual(0);
});

test("읽기는 공개, 쓰기는 인증이 필요하다", async ({ request }) => {
  const list = await request.get(`${V1}/posts?limit=2`);
  expect(list.status()).toBe(200);
  const body = await list.json();
  expect(body.data.length).toBeLessThanOrEqual(2);
  expect(body.pagination.total).toBeGreaterThan(0);

  const denied = await request.post(`${V1}/posts`, { data: { title: "무단", content: "작성" } });
  expect(denied.status()).toBe(401);
  expect((await denied.json()).error.code).toBe("unauthorized");
});

test("글 작성 → 웹 화면에 반영 → 수정 → 삭제", async ({ request, page }) => {
  const token = await getToken(request);
  const auth = { Authorization: `Bearer ${token}` };

  // 작성
  const created = await request.post(`${V1}/posts`, {
    headers: auth,
    data: { title: "E2E 로 만든 글", content: "공개 API 로 작성" },
  });
  expect(created.status()).toBe(201);
  const post = (await created.json()).data;
  expect(created.headers()["location"]).toContain(`/api/v1/posts/${post.id}`);

  // API 로 만든 글이 웹 화면에도 보여야 한다 (revalidateTag 로 "use cache" 목록을 무효화했으므로)
  await page.goto("/posts");
  await expect(page.getByRole("link", { name: "E2E 로 만든 글" })).toBeVisible();

  // 부분 수정: 제목만 바꾸고 본문은 유지
  const patched = await request.patch(`${V1}/posts/${post.id}`, {
    headers: auth,
    data: { title: "E2E 로 수정한 글" },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).data).toMatchObject({
    title: "E2E 로 수정한 글",
    content: "공개 API 로 작성",
  });

  // 댓글 + 답글
  const comment = await request.post(`${V1}/posts/${post.id}/comments`, {
    headers: auth,
    data: { content: "E2E 댓글" },
  });
  expect(comment.status()).toBe(201);
  const commentId = (await comment.json()).data.id;

  const reply = await request.post(`${V1}/posts/${post.id}/comments`, {
    headers: auth,
    data: { content: "E2E 답글", parentId: commentId },
  });
  expect(reply.status()).toBe(201);

  // 3단은 막힌다
  const third = await request.post(`${V1}/posts/${post.id}/comments`, {
    headers: auth,
    data: { content: "답글의 답글", parentId: (await reply.json()).data.id },
  });
  expect(third.status()).toBe(400);

  // 삭제 → 이후 조회는 404
  const removed = await request.delete(`${V1}/posts/${post.id}`, { headers: auth });
  expect(removed.status()).toBe(204);
  expect((await request.get(`${V1}/posts/${post.id}`)).status()).toBe(404);
});

test("API 키: 발급 → 사용 → 폐기 후 거부", async ({ request }) => {
  const token = await getToken(request);

  const created = await request.post(`${V1}/auth/keys`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "E2E 키" },
  });
  expect(created.status()).toBe(201);
  const { id, key, prefix } = (await created.json()).data;
  expect(key.startsWith("sk_")).toBe(true);

  // 발급받은 키로 바로 호출된다
  const me = await request.get(`${V1}/auth/me`, { headers: { Authorization: `Bearer ${key}` } });
  expect(me.status()).toBe(200);
  expect((await me.json()).data.via).toBe("api_key");

  // 목록에는 앞부분만 보이고 원문은 없다
  const listed = await request.get(`${V1}/auth/keys`, { headers: { Authorization: `Bearer ${token}` } });
  const found = (await listed.json()).data.find((k: { id: number }) => k.id === id);
  expect(found.prefix).toBe(prefix);
  expect(found.key).toBeUndefined();

  // API 키로는 또 다른 키를 만들 수 없다
  const escalation = await request.post(`${V1}/auth/keys`, {
    headers: { Authorization: `Bearer ${key}` },
    data: { name: "권한 상승" },
  });
  expect(escalation.status()).toBe(403);

  // 폐기하면 즉시 거부된다
  expect((await request.delete(`${V1}/auth/keys/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).status()).toBe(204);
  expect((await request.get(`${V1}/auth/me`, {
    headers: { Authorization: `Bearer ${key}` },
  })).status()).toBe(401);
});

test("세션 쿠키로는 공개 API 를 쓸 수 없다 (CSRF 차단)", async ({ page, request }) => {
  // 브라우저로 로그인해서 세션 쿠키를 만든다
  await page.goto("/login");
  const form = page.locator("form", { has: page.locator("#email") });
  await form.locator("#email").fill(DEMO.email);
  await form.locator("#password").fill(DEMO.password);
  await form.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/posts");

  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "session");
  expect(session).toBeTruthy();

  // 그 쿠키를 그대로 들고 API 를 불러도 인증되지 않는다 (Authorization 헤더만 본다)
  const res = await request.get(`${V1}/auth/me`, {
    headers: { Cookie: `session=${session!.value}` },
  });
  expect(res.status()).toBe(401);
});

test("에러 응답은 code 와 message 를 규약대로 준다", async ({ request }) => {
  const token = await getToken(request);

  const notFound = await request.get(`${V1}/posts/999999`);
  expect(notFound.status()).toBe(404);
  expect((await notFound.json()).error.code).toBe("not_found");

  const badId = await request.get(`${V1}/posts/abc`);
  expect(badId.status()).toBe(400);

  const overLimit = await request.get(`${V1}/posts?limit=9999`);
  expect(overLimit.status()).toBe(422);

  const invalid = await request.post(`${V1}/posts`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "", content: "" },
  });
  expect(invalid.status()).toBe(422);
  const body = await invalid.json();
  expect(body.error.code).toBe("validation_failed");
  expect(body.error.details.title).toBeTruthy(); // 필드별 메시지
});

test("할 일: 목록 필터 → 추가 → 완료 처리 → 삭제", async ({ request }) => {
  const auth = { Authorization: `Bearer ${await getToken(request)}` };

  const filtered = await request.get(`${V1}/todos?completed=false&limit=50`);
  expect(filtered.status()).toBe(200);
  const before = await filtered.json();
  expect(before.data.every((t: { completed: boolean }) => !t.completed)).toBe(true);

  const created = await request.post(`${V1}/todos`, { headers: auth, data: { title: "E2E 할 일" } });
  expect(created.status()).toBe(201);
  const id = (await created.json()).data.id;

  const patched = await request.patch(`${V1}/todos/${id}`, { headers: auth, data: { completed: true } });
  expect((await patched.json()).data.completed).toBe(true);

  expect((await request.delete(`${V1}/todos/${id}`, { headers: auth })).status()).toBe(204);
  expect((await request.get(`${V1}/todos/${id}`)).status()).toBe(404);
});
