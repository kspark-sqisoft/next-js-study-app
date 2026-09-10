// @vitest-environment node
// 통합 테스트: 실제 SQLite 파일(임시)에 대해 데이터 접근 함수를 검증한다.
// setup.ts 가 DATABASE_PATH 를 임시 경로로 바꿔 두므로 개발 DB 에는 영향이 없다.
// "use cache" 함수 안의 cacheLife/cacheTag 는 Next.js 런타임 밖에서 호출하면 에러가 나므로 no-op 으로 mock.
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
}));

const { createUser } = await import("./users");
const { createPost, deletePost } = await import("./posts");
const { createComment, deleteComment, findComment, getCommentThreads } = await import("./comments");
const { prisma } = await import("./prisma");

let demo: number;
let guest: number;
let postId: number;

beforeAll(async () => {
  demo = (await createUser("데모", "demo@test.local", "hash")).id;
  guest = (await createUser("게스트", "guest@test.local", "hash")).id;
  postId = (await createPost("글", "내용", demo)).id;
});

describe("comments", () => {
  it("평탄한 행을 2단 트리로 조립한다", async () => {
    const c1 = await createComment(postId, guest, "첫 댓글", null);
    const r1 = await createComment(postId, demo, "답글 1", c1);
    const r2 = await createComment(postId, guest, "답글 2", c1);
    const c2 = await createComment(postId, demo, "둘째 댓글", null);

    const threads = await getCommentThreads(postId);
    expect(threads.map((t) => t.id)).toEqual([c1, c2]);
    expect(threads[0].replies.map((r) => r.id)).toEqual([r1, r2]);
    expect(threads[0].replies[0].authorName).toBe("데모");
    expect(threads[1].replies).toEqual([]);
  });

  it("최상위 댓글을 지우면 답글도 함께 지워진다 (ON DELETE CASCADE)", async () => {
    const parent = await createComment(postId, guest, "지울 댓글", null);
    const reply = await createComment(postId, demo, "같이 지워질 답글", parent);

    expect(await deleteComment(parent)).toBe(true);
    expect(await findComment(parent)).toBeNull();
    expect(await findComment(reply)).toBeNull();
  });

  it("글을 지우면 댓글이 모두 지워진다", async () => {
    const otherPost = (await createPost("삭제될 글", "내용", demo)).id;
    await createComment(otherPost, guest, "댓글", null);
    await deletePost(otherPost);
    const left = await prisma.comment.count({ where: { postId: otherPost } });
    expect(left).toBe(0);
  });

  it("다른 글의 댓글은 섞이지 않는다", async () => {
    const another = (await createPost("다른 글", "내용", guest)).id;
    await createComment(another, guest, "다른 글 댓글", null);
    const threads = await getCommentThreads(another);
    expect(threads).toHaveLength(1);
    expect(threads[0].content).toBe("다른 글 댓글");
  });
});
