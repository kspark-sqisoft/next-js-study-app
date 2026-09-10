// @vitest-environment node
// 글 API: 읽기는 공개, 쓰기는 인증, 수정·삭제는 작성자 본인만.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { apiRequest, routeParams } from "@/test/api-request";

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

const { issueAccessToken } = await import("@/lib/api/auth");
const { createUser } = await import("@/lib/users");
const { createPost } = await import("@/lib/posts");
const { GET: listPostsRoute, POST: createPostRoute } = await import("./route");
const { GET: getPost, PATCH: patchPost, DELETE: deletePostRoute } = await import("./[id]/route");
const { GET: listComments, POST: createComment } = await import("./[id]/comments/route");
const { DELETE: deleteComment } = await import("../comments/[id]/route");

async function json<T = Record<string, never>>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

let ownerToken: string;
let strangerToken: string;
let ownerId: number;
let seededPostId: number;

beforeAll(async () => {
  ownerId = (await createUser("작성자", "post-owner@test.local", "hash")).id;
  const strangerId = (await createUser("남", "post-stranger@test.local", "hash")).id;
  ownerToken = await issueAccessToken(ownerId);
  strangerToken = await issueAccessToken(strangerId);

  await createPost("Next.js 캐싱", "Cache Components 이야기", ownerId);
  seededPostId = (await createPost("SQLite 연결", "node:sqlite 드라이버", ownerId)).id;
});

describe("GET /api/v1/posts", () => {
  it("인증 없이도 목록을 준다. data + pagination 봉투 모양", async () => {
    const res = await listPostsRoute(apiRequest("/api/v1/posts"));
    expect(res.status).toBe(200);

    const body = await json<{ data: Record<string, unknown>[]; pagination: Record<string, unknown> }>(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect(Object.keys(body.pagination).sort()).toEqual(["hasMore", "limit", "offset", "total"]);
    expect(Object.keys(body.data[0]).sort()).toEqual([
      "author", "content", "createdAt", "id", "imageUrl", "title", "updatedAt",
    ]);
  });

  it("q 로 검색한다", async () => {
    const res = await listPostsRoute(apiRequest("/api/v1/posts?q=SQLite"));
    const body = await json<{ data: { title: string }[]; pagination: { total: number } }>(res);
    expect(body.pagination.total).toBe(1);
    expect(body.data[0].title).toBe("SQLite 연결");
  });

  it("limit/offset 으로 페이지를 넘긴다", async () => {
    const first = await json<{ data: { id: number }[]; pagination: { hasMore: boolean } }>(
      await listPostsRoute(apiRequest("/api/v1/posts?limit=1&offset=0")),
    );
    const second = await json<{ data: { id: number }[]; pagination: { hasMore: boolean } }>(
      await listPostsRoute(apiRequest("/api/v1/posts?limit=1&offset=1")),
    );

    expect(first.data).toHaveLength(1);
    expect(first.pagination.hasMore).toBe(true);
    expect(second.data[0].id).not.toBe(first.data[0].id);
  });

  it("한도를 넘는 limit 은 조용히 잘라내지 않고 422 로 알려 준다", async () => {
    const res = await listPostsRoute(apiRequest("/api/v1/posts?limit=9999"));
    expect(res.status).toBe(422);
    expect(await json(res)).toMatchObject({ error: { code: "validation_failed" } });
  });

  it("응답은 캐시되면 안 된다 (Authorization 에 따라 달라지므로)", async () => {
    const res = await listPostsRoute(apiRequest("/api/v1/posts"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("POST /api/v1/posts", () => {
  it("토큰이 없으면 401", async () => {
    const res = await createPostRoute(apiRequest("/api/v1/posts", {
      method: "POST",
      body: { title: "무단 작성", content: "내용" },
    }));
    expect(res.status).toBe(401);
  });

  it("검증에 걸리면 422", async () => {
    const res = await createPostRoute(apiRequest("/api/v1/posts", {
      method: "POST",
      token: ownerToken,
      body: { title: "", content: "" },
    }));
    expect(res.status).toBe(422);
  });

  it("본문이 깨진 JSON 이면 400", async () => {
    const res = await createPostRoute(new NextRequest("http://localhost/api/v1/posts", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ownerToken}` },
      body: "{not json",
    }));
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: { code: "bad_request" } });
  });

  it("작성하면 201 과 Location 헤더", async () => {
    const res = await createPostRoute(apiRequest("/api/v1/posts", {
      method: "POST",
      token: ownerToken,
      body: { title: "API 로 쓴 글", content: "본문" },
    }));
    expect(res.status).toBe(201);

    const { data } = await json<{ data: { id: number; title: string; author: { id: number } } }>(res);
    expect(data.title).toBe("API 로 쓴 글");
    expect(data.author.id).toBe(ownerId); // 작성자는 본문이 아니라 토큰에서 온다
    expect(res.headers.get("Location")).toBe(`http://localhost/api/v1/posts/${data.id}`);
  });
});

describe("/api/v1/posts/:id", () => {
  it("없는 글은 404", async () => {
    const res = await getPost(apiRequest("/api/v1/posts/999999"), routeParams({ id: "999999" }));
    expect(res.status).toBe(404);
  });

  it("id 가 숫자가 아니면 400", async () => {
    const res = await getPost(apiRequest("/api/v1/posts/abc"), routeParams({ id: "abc" }));
    expect(res.status).toBe(400);
  });

  it("PATCH 는 보낸 필드만 바꾼다", async () => {
    const res = await patchPost(
      apiRequest(`/api/v1/posts/${seededPostId}`, { method: "PATCH", token: ownerToken, body: { title: "제목만 변경" } }),
      routeParams({ id: String(seededPostId) }),
    );
    expect(res.status).toBe(200);

    const { data } = await json<{ data: { title: string; content: string } }>(res);
    expect(data.title).toBe("제목만 변경");
    expect(data.content).toBe("node:sqlite 드라이버"); // 본문은 그대로
  });

  it("빈 PATCH 는 422", async () => {
    const res = await patchPost(
      apiRequest(`/api/v1/posts/${seededPostId}`, { method: "PATCH", token: ownerToken, body: {} }),
      routeParams({ id: String(seededPostId) }),
    );
    expect(res.status).toBe(422);
  });

  it("남의 글은 수정할 수 없다 (403)", async () => {
    const res = await patchPost(
      apiRequest(`/api/v1/posts/${seededPostId}`, { method: "PATCH", token: strangerToken, body: { title: "가로채기" } }),
      routeParams({ id: String(seededPostId) }),
    );
    expect(res.status).toBe(403);
  });

  it("남의 글은 삭제할 수 없다 (403)", async () => {
    const res = await deletePostRoute(
      apiRequest(`/api/v1/posts/${seededPostId}`, { method: "DELETE", token: strangerToken }),
      routeParams({ id: String(seededPostId) }),
    );
    expect(res.status).toBe(403);
  });

  it("본인 글은 삭제되고 204, 그 뒤 조회는 404", async () => {
    const created = await json<{ data: { id: number } }>(
      await createPostRoute(apiRequest("/api/v1/posts", {
        method: "POST",
        token: ownerToken,
        body: { title: "지울 글", content: "본문" },
      })),
    );
    const id = String(created.data.id);

    const res = await deletePostRoute(
      apiRequest(`/api/v1/posts/${id}`, { method: "DELETE", token: ownerToken }),
      routeParams({ id }),
    );
    expect(res.status).toBe(204);
    expect((await getPost(apiRequest(`/api/v1/posts/${id}`), routeParams({ id }))).status).toBe(404);
  });
});

describe("/api/v1/posts/:id/comments", () => {
  it("댓글을 쓰고 목록으로 읽는다", async () => {
    const id = String(seededPostId);
    const created = await createComment(
      apiRequest(`/api/v1/posts/${id}/comments`, { method: "POST", token: ownerToken, body: { content: "첫 댓글" } }),
      routeParams({ id }),
    );
    expect(created.status).toBe(201);
    const comment = (await json<{ data: { id: number; parentId: number | null } }>(created)).data;
    expect(comment.parentId).toBeNull();

    const listed = await json<{ data: { id: number }[] }>(
      await listComments(apiRequest(`/api/v1/posts/${id}/comments`), routeParams({ id })),
    );
    expect(listed.data.map((c) => c.id)).toContain(comment.id);
  });

  it("답글의 답글(3단)은 400", async () => {
    const id = String(seededPostId);
    const top = (await json<{ data: { id: number } }>(
      await createComment(
        apiRequest(`/api/v1/posts/${id}/comments`, { method: "POST", token: ownerToken, body: { content: "부모" } }),
        routeParams({ id }),
      ),
    )).data;

    const reply = (await json<{ data: { id: number; parentId: number } }>(
      await createComment(
        apiRequest(`/api/v1/posts/${id}/comments`, {
          method: "POST", token: ownerToken, body: { content: "답글", parentId: top.id },
        }),
        routeParams({ id }),
      ),
    )).data;
    expect(reply.parentId).toBe(top.id);

    const third = await createComment(
      apiRequest(`/api/v1/posts/${id}/comments`, {
        method: "POST", token: ownerToken, body: { content: "답글의 답글", parentId: reply.id },
      }),
      routeParams({ id }),
    );
    expect(third.status).toBe(400);
  });

  it("남의 댓글은 삭제할 수 없다 (403)", async () => {
    const id = String(seededPostId);
    const comment = (await json<{ data: { id: number } }>(
      await createComment(
        apiRequest(`/api/v1/posts/${id}/comments`, { method: "POST", token: ownerToken, body: { content: "내 댓글" } }),
        routeParams({ id }),
      ),
    )).data;

    const res = await deleteComment(
      apiRequest(`/api/v1/comments/${comment.id}`, { method: "DELETE", token: strangerToken }),
      routeParams({ id: String(comment.id) }),
    );
    expect(res.status).toBe(403);
  });

  it("없는 글에 댓글을 달면 404", async () => {
    const res = await createComment(
      apiRequest("/api/v1/posts/999999/comments", { method: "POST", token: ownerToken, body: { content: "x" } }),
      routeParams({ id: "999999" }),
    );
    expect(res.status).toBe(404);
  });
});
