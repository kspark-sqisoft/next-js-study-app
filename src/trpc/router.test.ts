// @vitest-environment node
// tRPC 라우터 테스트: HTTP 없이 createCaller 로 프로시저를 함수처럼 부른다. ctx 는 가짜 사용자를 직접 넣는다.
// (Server Action 은 이렇게 부르기 어렵다. 프로시저가 "그냥 함수" 라는 점이 tRPC 의 테스트 장점이다)
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn(), revalidateTag: vi.fn() }));

const { createUser } = await import("@/lib/users");
const { createPost } = await import("@/lib/posts");
const { appRouter } = await import("./routers/_app");
const { createCallerFactory } = await import("./init");
const { revalidateTag } = await import("next/cache");

const createCaller = createCallerFactory(appRouter);
type User = { id: number; name: string; email: string };
let demo: User;
let guest: User;
let postId: number;

beforeAll(() => {
  demo = createUser("데모", "demo@t.local", "hash");
  guest = createUser("게스트", "guest@t.local", "hash");
  postId = createPost("tRPC 검색용 글", "본문 스트리밍", demo.id).id;
  for (let i = 1; i <= 6; i++) createPost(`목록 글 ${i}`, "x", demo.id);
});

describe("posts 라우터", () => {
  const anon = createCaller({ user: null });

  it("search 는 제목/본문을 검색하고 필요한 필드만 돌려준다", async () => {
    const r = await anon.posts.search({ q: "스트리밍" });
    expect(r.posts.map((p) => p.title)).toEqual(["tRPC 검색용 글"]);
    expect(Object.keys(r.posts[0]).sort()).toEqual(["createdAt", "id", "title"]);
    expect(r.total).toBe(7);
  });

  it("list 는 커서로 이어지고 마지막에 nextCursor 가 null", async () => {
    const p1 = await anon.posts.list({ limit: 3 });
    expect(p1.posts).toHaveLength(3);
    const p2 = await anon.posts.list({ limit: 3, cursor: p1.nextCursor });
    expect(p2.posts.every((p) => p.id < p1.nextCursor!)).toBe(true);
    const p3 = await anon.posts.list({ limit: 3, cursor: p2.nextCursor });
    expect(p3.nextCursor).toBeNull();
    const all = [...p1.posts, ...p2.posts, ...p3.posts].map((p) => p.id);
    expect(new Set(all).size).toBe(7);
  });

  it("byId 는 없는 글에 NOT_FOUND 를 던진다", async () => {
    await expect(anon.posts.byId({ id: 99999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("입력 검증: limit 이 범위를 벗어나면 BAD_REQUEST", async () => {
    await expect(anon.posts.list({ limit: 999 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("comments 라우터", () => {
  it("로그아웃 상태에서 add 는 UNAUTHORIZED", async () => {
    const anon = createCaller({ user: null });
    await expect(anon.comments.add({ postId, content: "x" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("댓글 → 답글은 되고, 답글의 답글(3단)은 BAD_REQUEST", async () => {
    const asGuest = createCaller({ user: guest });
    const { id: c1 } = await asGuest.comments.add({ postId, content: "첫 댓글" });
    const { id: r1 } = await asGuest.comments.add({ postId, content: "답글", parentId: c1 });
    await expect(asGuest.comments.add({ postId, content: "3단", parentId: r1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const threads = await asGuest.comments.list({ postId });
    expect(threads).toHaveLength(1);
    expect(threads[0].replies.map((r) => r.id)).toEqual([r1]);
    // 변경 후 캐시 태그 무효화가 호출됐다 (Route Handler 컨텍스트라 revalidateTag)
    expect(revalidateTag).toHaveBeenCalledWith(`post-${postId}-comments`, { expire: 0 });
  });

  it("remove 는 작성자 본인만 (남의 댓글은 FORBIDDEN)", async () => {
    const asGuest = createCaller({ user: guest });
    const asDemo = createCaller({ user: demo });
    const { id } = await asGuest.comments.add({ postId, content: "게스트 댓글" });
    await expect(asDemo.comments.remove({ id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(asGuest.comments.remove({ id })).resolves.toEqual({ ok: true });
    await expect(asGuest.comments.remove({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("빈 내용은 검증에서 걸린다", async () => {
    const asGuest = createCaller({ user: guest });
    await expect(asGuest.comments.add({ postId, content: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
