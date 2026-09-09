// @vitest-environment node
// Route Handler 는 (Request) => Response 인 일반 함수라서 서버 없이 직접 호출해 테스트할 수 있다.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn(), revalidateTag: vi.fn() }));

const { createUser } = await import("@/lib/users");
const { createPost } = await import("@/lib/posts");
const { GET } = await import("./route");

beforeAll(() => {
  const u = createUser("u", "u@test.local", "hash").id;
  createPost("Next.js 캐싱", "내용", u);
  createPost("SQLite 연결", "Next.js 에서 사용", u);
});

describe("GET /api/posts", () => {
  it("q 로 제목/본문을 검색해 JSON 을 돌려준다", async () => {
    const res = await GET(new NextRequest("http://localhost/api/posts?q=Next.js"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe("Next.js");
    expect(body.total).toBe(2);
    expect(body.posts.map((p: { title: string }) => p.title).sort()).toEqual(["Next.js 캐싱", "SQLite 연결"]);
    // 응답에는 필요한 필드만 (본문 전체는 내려보내지 않는다)
    expect(Object.keys(body.posts[0]).sort()).toEqual(["createdAt", "id", "title"]);
  });

  it("q 가 없으면 전체", async () => {
    const body = await (await GET(new NextRequest("http://localhost/api/posts"))).json();
    expect(body.posts).toHaveLength(2);
  });
});
