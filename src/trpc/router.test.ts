// @vitest-environment node
// tRPC 라우터 테스트: HTTP 서버 없이 createCaller 로 프로시저를 일반 함수처럼 부른다.
//
// [왜 이렇게 테스트할 수 있나]
// 프로시저는 결국 (input, ctx) 를 받는 함수다. createCallerFactory(appRouter)(ctx) 는 그 함수들을 ctx 가 고정된 채
// 바로 호출할 수 있는 객체로 만든다. 브라우저도, /api/trpc 도, fetch 도 없이 입력 검증·권한·비즈니스 규칙을 검증한다.
// main 브랜치의 Server Action 은 useActionState 와 FormData 에 묶여 있어 이런 단위 테스트가 어려웠다 (그래서 E2E 로만 검증했다).
//
// [ctx 를 가짜로 넣는다]
// 실제 컨텍스트(init.ts 의 createTRPCContext)는 쿠키를 읽는다. 테스트에는 요청이 없으므로 { user: null } 이나
// { user: guest } 를 직접 넣어 "로그아웃 상태", "게스트로 로그인한 상태" 를 만든다.
//
// [next/cache 를 mock 하는 이유]
// getCommentThreads 는 "use cache" 함수라 안에서 cacheLife/cacheTag 를 부르고, 프로시저는 revalidateTag 를 부른다.
// 이 함수들은 Next.js 런타임 밖에서 호출하면 에러가 나므로 no-op 으로 바꾼다. revalidateTag 는 vi.fn() 이라
// "호출됐는지, 어떤 태그로 호출됐는지" 를 검증할 수 있다 (아래 toHaveBeenCalledWith).
//
// DB 는 src/test/setup.ts 가 테스트 파일마다 만드는 임시 SQLite 파일이다.
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn(), revalidateTag: vi.fn() }));

const { createUser } = await import("@/lib/users");
const { createPost } = await import("@/lib/posts");
const { appRouter } = await import("./routers/_app");
const { createCallerFactory } = await import("./init");
const { revalidateTag } = await import("next/cache");

const createCaller = createCallerFactory(appRouter); // ctx 를 넣으면 "그 사용자로 부르는" caller 가 나온다
type User = { id: number; name: string; email: string };
let demo: User;
let guest: User;
let postId: number;

// 테스트 데이터: 사용자 둘, 검색용 글 하나, 목록용 글 여섯 (총 7개 → 커서 테스트에서 3+3+1 로 나뉜다)
beforeAll(() => {
  demo = createUser("데모", "demo@t.local", "hash");
  guest = createUser("게스트", "guest@t.local", "hash");
  postId = createPost("tRPC 검색용 글", "본문 스트리밍", demo.id).id;
  for (let i = 1; i <= 6; i++) createPost(`목록 글 ${i}`, "x", demo.id);
});

describe("posts 라우터", () => {
  const anon = createCaller({ user: null }); // 로그아웃 상태. 조회는 publicProcedure 라 그대로 된다

  // 증명하는 것: 검색이 lib 의 searchPosts 를 거쳐 동작하고, 반환 객체가 목록에 필요한 3개 필드만 갖는다(본문 노출 없음)
  it("search 는 제목/본문을 검색하고 필요한 필드만 돌려준다", async () => {
    const r = await anon.posts.search({ q: "스트리밍" });
    expect(r.posts.map((p) => p.title)).toEqual(["tRPC 검색용 글"]);
    expect(Object.keys(r.posts[0]).sort()).toEqual(["createdAt", "id", "title"]);
    expect(r.total).toBe(7);
  });

  // 증명하는 것: cursor 입력이 "그 id 보다 작은 글" 로 이어지고, 페이지를 합쳐도 중복·누락이 없으며, 끝에서 null 이 온다
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

  // 증명하는 것: 프로시저가 throw 한 TRPCError 가 caller 에서는 rejected Promise 로 오고, code 로 구분할 수 있다
  it("byId 는 없는 글에 NOT_FOUND 를 던진다", async () => {
    await expect(anon.posts.byId({ id: 99999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // 증명하는 것: .input(zod) 검증은 프로시저 본문보다 먼저 실행되고, 실패는 BAD_REQUEST 코드다
  it("입력 검증: limit 이 범위를 벗어나면 BAD_REQUEST", async () => {
    await expect(anon.posts.list({ limit: 999 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("comments 라우터", () => {
  // 증명하는 것: protectedProcedure 의 미들웨어가 본문 전에 막는다 (댓글이 만들어지지 않는다)
  it("로그아웃 상태에서 add 는 UNAUTHORIZED", async () => {
    const anon = createCaller({ user: null });
    await expect(anon.comments.add({ postId, content: "x" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  // 증명하는 것: 2단 제한 규칙, 트리 조립(replies), 그리고 변경 후 revalidateTag 가 올바른 태그로 호출된다
  it("댓글 → 답글은 되고, 답글의 답글(3단)은 BAD_REQUEST", async () => {
    const asGuest = createCaller({ user: guest }); // 게스트로 로그인한 상태
    const { id: c1 } = await asGuest.comments.add({ postId, content: "첫 댓글" });
    const { id: r1 } = await asGuest.comments.add({ postId, content: "답글", parentId: c1 });
    await expect(asGuest.comments.add({ postId, content: "3단", parentId: r1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const threads = await asGuest.comments.list({ postId });
    expect(threads).toHaveLength(1);
    expect(threads[0].replies.map((r) => r.id)).toEqual([r1]);
    // 변경 후 캐시 태그 무효화가 호출됐다 (Route Handler 컨텍스트라 revalidateTag)
    expect(revalidateTag).toHaveBeenCalledWith(`post-${postId}-comments`, { expire: 0 });
  });

  // 증명하는 것: 소유권 검사. 같은 댓글을 다른 사용자(demo)가 지우면 FORBIDDEN, 본인이 지우면 성공, 다시 지우면 NOT_FOUND
  it("remove 는 작성자 본인만 (남의 댓글은 FORBIDDEN)", async () => {
    const asGuest = createCaller({ user: guest });
    const asDemo = createCaller({ user: demo });
    const { id } = await asGuest.comments.add({ postId, content: "게스트 댓글" });
    await expect(asDemo.comments.remove({ id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(asGuest.comments.remove({ id })).resolves.toEqual({ ok: true });
    await expect(asGuest.comments.remove({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // 증명하는 것: main 의 commentSchema(trim 후 1자 이상)가 .extend 를 거쳐도 그대로 적용된다
  it("빈 내용은 검증에서 걸린다", async () => {
    const asGuest = createCaller({ user: guest });
    await expect(asGuest.comments.add({ postId, content: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
