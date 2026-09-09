// @vitest-environment node
// 공개 API 인증 흐름 전체: 가입 → 토큰 발급 → 토큰으로 신원 확인 → API 키 발급/폐기.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { apiRequest, routeParams } from "@/test/api-request";

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

const { POST: register } = await import("./register/route");
const { POST: token } = await import("./token/route");
const { GET: me } = await import("./me/route");
const { GET: listKeys, POST: createKey } = await import("./keys/route");
const { DELETE: revokeKey } = await import("./keys/[id]/route");

const EMAIL = "api-user@test.local";
const PASSWORD = "password123";

async function json<T = Record<string, never>>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

let accessToken: string;

beforeAll(async () => {
  const res = await register(apiRequest("/api/v1/auth/register", {
    method: "POST",
    body: { name: "API 사용자", email: EMAIL, password: PASSWORD },
  }));
  expect(res.status).toBe(201);
  accessToken = (await json<{ data: { accessToken: string } }>(res)).data.accessToken;
});

describe("POST /api/v1/auth/register", () => {
  it("이미 가입된 이메일이면 409", async () => {
    const res = await register(apiRequest("/api/v1/auth/register", {
      method: "POST",
      body: { name: "중복", email: EMAIL, password: PASSWORD },
    }));
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ error: { code: "conflict" } });
  });

  it("검증에 걸리면 422 와 필드별 메시지", async () => {
    const res = await register(apiRequest("/api/v1/auth/register", {
      method: "POST",
      body: { name: "짧", email: "이메일아님", password: "123" },
    }));
    expect(res.status).toBe(422);
    const body = await json<{ error: { code: string; details: Record<string, string[]> } }>(res);
    expect(body.error.code).toBe("validation_failed");
    expect(Object.keys(body.error.details).sort()).toEqual(["email", "name", "password"]);
  });

  it("Content-Type 이 JSON 이 아니면 415", async () => {
    const res = await register(apiRequest("/api/v1/auth/register", {
      method: "POST",
      body: { name: "x", email: "a@b.com", password: "password123" },
      contentType: "text/plain",
    }));
    expect(res.status).toBe(415);
  });
});

describe("POST /api/v1/auth/token", () => {
  it("올바른 자격증명이면 토큰을 준다", async () => {
    const res = await token(apiRequest("/api/v1/auth/token", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD },
    }));
    expect(res.status).toBe(200);

    const { data } = await json<{
      data: { accessToken: string; tokenType: string; expiresIn: number; user: { email: string } };
    }>(res);
    expect(data.tokenType).toBe("Bearer");
    expect(data.expiresIn).toBeGreaterThan(0);
    expect(data.user.email).toBe(EMAIL);
    expect(data.accessToken.split(".")).toHaveLength(3); // JWT 는 점 두 개로 나뉜 세 부분
  });

  it("비밀번호가 틀리면 401", async () => {
    const res = await token(apiRequest("/api/v1/auth/token", {
      method: "POST",
      body: { email: EMAIL, password: "wrong-password" },
    }));
    expect(res.status).toBe(401);
  });

  it("없는 이메일도 비밀번호 오류와 같은 메시지 (계정 열거 방지)", async () => {
    const wrongPassword = await token(apiRequest("/api/v1/auth/token", {
      method: "POST",
      body: { email: EMAIL, password: "wrong-password" },
    }));
    const noSuchUser = await token(apiRequest("/api/v1/auth/token", {
      method: "POST",
      body: { email: "nobody@test.local", password: "whatever12" },
    }));

    expect(noSuchUser.status).toBe(wrongPassword.status);
    expect(await json(noSuchUser)).toEqual(await json(wrongPassword));
  });
});

describe("GET /api/v1/auth/me", () => {
  it("토큰이 없으면 401", async () => {
    const res = await me(apiRequest("/api/v1/auth/me"));
    expect(res.status).toBe(401);
    expect(await json(res)).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("Bearer 형식이 아니면 401", async () => {
    const request = apiRequest("/api/v1/auth/me");
    request.headers.set("authorization", `Basic ${accessToken}`);
    expect((await me(request)).status).toBe(401);
  });

  it("위조된 토큰은 401", async () => {
    const res = await me(apiRequest("/api/v1/auth/me", { token: `${accessToken}tampered` }));
    expect(res.status).toBe(401);
  });

  it("유효한 토큰이면 사용자 정보를 준다", async () => {
    const res = await me(apiRequest("/api/v1/auth/me", { token: accessToken }));
    expect(res.status).toBe(200);

    const { data } = await json<{ data: { user: Record<string, unknown>; via: string } }>(res);
    expect(data.user.email).toBe(EMAIL);
    expect(data.via).toBe("access_token");
    expect(data.user).not.toHaveProperty("password_hash"); // 해시가 새어 나가면 안 된다
  });

  it("레이트 리밋 헤더가 항상 붙는다", async () => {
    const res = await me(apiRequest("/api/v1/auth/me", { token: accessToken }));
    expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
    expect(Number(res.headers.get("X-RateLimit-Remaining"))).toBeGreaterThanOrEqual(0);
  });
});

describe("/api/v1/auth/keys", () => {
  it("발급 응답에만 키 원문이 들어 있다", async () => {
    const created = await createKey(apiRequest("/api/v1/auth/keys", {
      method: "POST",
      token: accessToken,
      body: { name: "내 봇" },
    }));
    expect(created.status).toBe(201);

    const { data } = await json<{ data: { id: number; key: string; prefix: string } }>(created);
    expect(data.key.startsWith("sk_")).toBe(true);

    // 목록에는 앞부분만 있고 원문은 없다
    const listed = await json<{ data: { id: number; prefix: string }[] }>(
      await listKeys(apiRequest("/api/v1/auth/keys", { token: accessToken })),
    );
    const found = listed.data.find((k) => k.id === data.id);
    expect(found?.prefix).toBe(data.prefix);
    expect(found).not.toHaveProperty("key");
  });

  it("발급받은 API 키로 다른 엔드포인트를 호출할 수 있다", async () => {
    const created = await createKey(apiRequest("/api/v1/auth/keys", {
      method: "POST",
      token: accessToken,
      body: { name: "호출용" },
    }));
    const { key } = (await json<{ data: { key: string } }>(created)).data;

    const res = await me(apiRequest("/api/v1/auth/me", { token: key }));
    expect(res.status).toBe(200);
    expect((await json<{ data: { via: string } }>(res)).data.via).toBe("api_key");
  });

  it("API 키로는 또 다른 키를 만들 수 없다 (403)", async () => {
    const created = await createKey(apiRequest("/api/v1/auth/keys", {
      method: "POST",
      token: accessToken,
      body: { name: "권한 상승 시도" },
    }));
    const { key } = (await json<{ data: { key: string } }>(created)).data;

    const res = await createKey(apiRequest("/api/v1/auth/keys", {
      method: "POST",
      token: key,
      body: { name: "두 번째 키" },
    }));
    expect(res.status).toBe(403);
  });

  it("폐기하면 204 이고, 그 키로는 더 이상 인증되지 않는다", async () => {
    const created = await createKey(apiRequest("/api/v1/auth/keys", {
      method: "POST",
      token: accessToken,
      body: { name: "폐기할 키" },
    }));
    const { id, key } = (await json<{ data: { id: number; key: string } }>(created)).data;

    const revoked = await revokeKey(
      apiRequest(`/api/v1/auth/keys/${id}`, { method: "DELETE", token: accessToken }),
      routeParams({ id: String(id) }),
    );
    expect(revoked.status).toBe(204);

    expect((await me(apiRequest("/api/v1/auth/me", { token: key }))).status).toBe(401);
  });

  it("없는 키를 폐기하면 404", async () => {
    const res = await revokeKey(
      apiRequest("/api/v1/auth/keys/999999", { method: "DELETE", token: accessToken }),
      routeParams({ id: "999999" }),
    );
    expect(res.status).toBe(404);
  });
});
