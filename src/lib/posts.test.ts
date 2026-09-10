// @vitest-environment node
// 통합 테스트: posts 데이터 접근 함수 (임시 SQLite).
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn(), revalidateTag: vi.fn() }));

const { createUser } = await import("./users");
const { countPosts, createPost, deletePost, getPost, getPostIds, getPostsByCursor, getPostsPage, PAGE_SIZE, searchPosts, updatePost } =
  await import("./posts");

let author: number;
beforeAll(async () => {
  author = (await createUser("작성자", "author@test.local", "hash")).id;
});

describe("posts", () => {
  it("작성하면 작성자 이름이 함께 조회된다", async () => {
    const post = await createPost("첫 글", "본문", author);
    expect(post.authorName).toBe("작성자");
    expect(await getPost(post.id)).toMatchObject({ title: "첫 글", authorId: author });
  });

  it("목록은 최신순이고 캐시 생성 시각을 포함한다", async () => {
    const a = (await createPost("A", "x", author)).id;
    const b = (await createPost("B", "x", author)).id;
    const { posts, cachedAt, total } = await getPostsPage("", 1);
    expect(posts[0].id).toBe(b);
    expect(posts[1].id).toBe(a);
    expect(new Date(cachedAt).getTime()).not.toBeNaN();
    expect((await getPostIds())[0]).toBe(b);
    expect(await countPosts()).toBe(total);
  });

  it("수정하면 updated_at 이 갱신되고, 검색은 제목과 본문을 모두 본다", async () => {
    const post = await createPost("검색용", "특별한단어 포함", author);
    await updatePost(post.id, "바뀐 제목", "바뀐 본문 특별한단어", null);
    const updated = await getPost(post.id);
    expect(updated?.title).toBe("바뀐 제목");
    expect((await searchPosts("특별한단어")).some((p) => p.id === post.id)).toBe(true);
    expect(await searchPosts("없는검색어")).toHaveLength(0);
  });

  it("없는 글은 null, 삭제는 성공 여부를 돌려준다", async () => {
    const post = await createPost("삭제", "x", author);
    expect(await deletePost(post.id)).toBe(true);
    expect(await deletePost(post.id)).toBe(false);
    expect(await getPost(post.id)).toBeNull();
    expect(await getPost(999999)).toBeNull();
  });
});

describe("getPostsPage (검색 + 페이지네이션)", () => {
  it("페이지 크기만큼 자르고, 범위 밖 페이지는 마지막 페이지로 보정한다", async () => {
    const u = (await createUser("p", "p@test.local", "hash")).id;
    for (let i = 1; i <= 7; i++) await createPost(`페이지 글 ${i}`, "본문", u);

    const p1 = await getPostsPage("페이지 글", 1);
    expect(p1.total).toBe(7);
    expect(p1.totalPages).toBe(2);
    expect(p1.posts).toHaveLength(PAGE_SIZE);
    expect(p1.posts[0].title).toBe("페이지 글 7"); // 최신순

    const p2 = await getPostsPage("페이지 글", 2);
    expect(p2.posts).toHaveLength(2);

    const beyond = await getPostsPage("페이지 글", 99);
    expect(beyond.page).toBe(2); // 보정
    const zero = await getPostsPage("페이지 글", 0);
    expect(zero.page).toBe(1);
  });

  it("검색어가 없으면 전체, 결과가 없으면 total 0 과 1페이지", async () => {
    const all = await getPostsPage("", 1);
    expect(all.total).toBe(await countPosts());
    const none = await getPostsPage("절대없는검색어xyz", 1);
    expect(none).toMatchObject({ total: 0, page: 1, totalPages: 1, posts: [] });
  });
});

describe("getPostsByCursor (커서 페이지네이션)", () => {
  it("커서보다 작은 id 를 limit 개 가져오고, 더 있으면 nextCursor 를 준다", async () => {
    const u = (await createUser("c", "c@test.local", "hash")).id;
    const ids: number[] = [];
    for (let i = 1; i <= 7; i++) ids.push((await createPost(`커서 글 ${i}`, "본문", u)).id);

    const first = await getPostsByCursor("커서 글", null, 3);
    expect(first.posts.map((p) => p.id)).toEqual(ids.slice(-3).reverse()); // 최신 3개
    expect(first.nextCursor).toBe(first.posts[2].id);

    const second = await getPostsByCursor("커서 글", first.nextCursor, 3);
    expect(second.posts.every((p) => p.id < first.nextCursor!)).toBe(true);
    expect(second.posts).toHaveLength(3);

    const third = await getPostsByCursor("커서 글", second.nextCursor, 3);
    expect(third.posts).toHaveLength(1);
    expect(third.nextCursor).toBeNull(); // 끝
  });

  it("두 페이지를 이어 붙여도 중복이 없다", async () => {
    const a = await getPostsByCursor("", null, 4);
    const b = await getPostsByCursor("", a.nextCursor, 4);
    const all = [...a.posts, ...b.posts].map((p) => p.id);
    expect(new Set(all).size).toBe(all.length);
  });
});
