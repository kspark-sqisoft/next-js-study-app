// @vitest-environment node
// 통합 테스트: posts 데이터 접근 함수 (임시 SQLite).
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn(), revalidateTag: vi.fn() }));

const { createUser } = await import("./users");
const { countPosts, createPost, deletePost, getPost, getPostIds, getPosts, searchPosts, updatePost } =
  await import("./posts");

let author: number;
beforeAll(() => {
  author = createUser("작성자", "author@test.local", "hash").id;
});

describe("posts", () => {
  it("작성하면 작성자 이름이 함께 조회된다", async () => {
    const post = createPost("첫 글", "본문", author);
    expect(post.authorName).toBe("작성자");
    expect(await getPost(post.id)).toMatchObject({ title: "첫 글", authorId: author });
  });

  it("목록은 최신순이고 캐시 생성 시각을 포함한다", async () => {
    const a = createPost("A", "x", author).id;
    const b = createPost("B", "x", author).id;
    const { posts, cachedAt } = await getPosts();
    expect(posts[0].id).toBe(b);
    expect(posts[1].id).toBe(a);
    expect(new Date(cachedAt).getTime()).not.toBeNaN();
    expect(getPostIds()[0]).toBe(b);
    expect(countPosts()).toBe(posts.length);
  });

  it("수정하면 updated_at 이 갱신되고, 검색은 제목과 본문을 모두 본다", async () => {
    const post = createPost("검색용", "특별한단어 포함", author);
    updatePost(post.id, "바뀐 제목", "바뀐 본문 특별한단어");
    const updated = await getPost(post.id);
    expect(updated?.title).toBe("바뀐 제목");
    expect(searchPosts("특별한단어").some((p) => p.id === post.id)).toBe(true);
    expect(searchPosts("없는검색어")).toHaveLength(0);
  });

  it("없는 글은 null, 삭제는 성공 여부를 돌려준다", async () => {
    const post = createPost("삭제", "x", author);
    expect(deletePost(post.id)).toBe(true);
    expect(deletePost(post.id)).toBe(false);
    expect(await getPost(post.id)).toBeNull();
    expect(await getPost(999999)).toBeNull();
  });
});
