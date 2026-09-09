// 서버 전용. posts 테이블 접근 함수 모음.
// 조회 함수 중 일부는 "use cache" 로 캐시된다 (Cache Components 모델).
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { db } from "@/lib/db";

export type Post = {
  id: number;
  title: string;
  content: string;
  authorId: number | null; // NULL 이면 작성자 없음 (초기 샘플 등)
  authorName: string | null;
  imagePath: string | null; // 첨부 이미지 파일명. 화면에서는 /api/uploads/<파일명> 으로 접근
  createdAt: string;
  updatedAt: string;
};

type PostRow = {
  id: number;
  title: string;
  content: string;
  author_id: number | null;
  author_name: string | null;
  image_path: string | null;
  created_at: string;
  updated_at: string;
};

// users 를 LEFT JOIN 해서 작성자 이름까지 한 번에 가져온다
const SELECT_POST = `
  SELECT p.*, u.name AS author_name
  FROM posts p
  LEFT JOIN users u ON u.id = p.author_id
`;

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    authorId: row.author_id,
    authorName: row.author_name,
    imagePath: row.image_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// 캐시되는 조회 (ISR)
// ---------------------------------------------------------------------------

/**
 * 글 목록. "use cache" 로 결과가 캐시된다.
 * - cacheLife("minutes"): 1분 지나면 다음 요청 때 백그라운드에서 다시 생성 (시간 기반 ISR)
 * - cacheTag("posts"):    글을 추가/수정/삭제하는 Server Action 에서 updateTag("posts") 로 즉시 무효화 (온디맨드)
 * 반환값에 캐시 생성 시각을 넣어 두면, 새로고침해도 시각이 안 바뀌는 것으로 캐시를 눈으로 확인할 수 있다.
 * 로그인 여부와 무관한 데이터라 사용자 구분 없이 하나의 캐시를 모두가 공유한다.
 */
export async function getPosts(): Promise<{ posts: Post[]; cachedAt: string }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("posts");

  const rows = db.prepare(`${SELECT_POST} ORDER BY p.id DESC`).all() as PostRow[];
  return { posts: rows.map(toPost), cachedAt: new Date().toISOString() };
}

export const PAGE_SIZE = 5;

export type PostsPage = {
  posts: Post[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
  cachedAt: string;
};

/**
 * 검색 + 페이지네이션 목록. /posts?q=검색어&page=2 에서 사용.
 * 인자(query, page)가 캐시 키에 포함되므로 "검색어 × 페이지" 조합마다 별도 캐시 엔트리가 생긴다.
 * 태그는 같은 "posts" 라서 글이 바뀌면 모든 조합이 한 번에 무효화된다.
 * searchParams 자체는 여기서 읽지 않는다. 캐시 함수 안에서는 요청 API 를 읽을 수 없으므로
 * 호출하는 쪽(페이지)이 값을 꺼내서 인자로 넘긴다.
 */
export async function getPostsPage(query: string, page: number): Promise<PostsPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag("posts");

  const like = `%${query}%`;
  const where = query ? "WHERE p.title LIKE ? OR p.content LIKE ?" : "";
  const params = query ? [like, like] : [];

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM posts p ${where}`)
    .get(...params) as { total: number };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const rows = db
    .prepare(`${SELECT_POST} ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`)
    .all(...params, PAGE_SIZE, (safePage - 1) * PAGE_SIZE) as PostRow[];

  return {
    posts: rows.map(toPost),
    total,
    page: safePage,
    totalPages,
    query,
    cachedAt: new Date().toISOString(),
  };
}

/**
 * 글 한 건. id 별로 별도 캐시 엔트리가 만들어진다 (인자가 캐시 키에 포함됨).
 * 태그를 두 개 달아서 "전체 무효화(posts)" 와 "이 글만 무효화(post-3)" 둘 다 가능하게 한다.
 */
export async function getPost(id: number): Promise<Post | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("posts", `post-${id}`);

  const row = db.prepare(`${SELECT_POST} WHERE p.id = ?`).get(id) as PostRow | undefined;
  return row ? toPost(row) : null;
}

// ---------------------------------------------------------------------------
// 캐시되지 않는 조회 (요청 시점에 실행)
// ---------------------------------------------------------------------------

/** generateStaticParams 용. 빌드 시점에 실행되어 미리 렌더링할 id 목록을 준다. */
export function getPostIds(): number[] {
  const rows = db.prepare("SELECT id FROM posts ORDER BY id DESC").all() as { id: number }[];
  return rows.map((r) => r.id);
}

/**
 * 스트리밍 데모용: 현재 글을 제외한 다른 글 목록.
 * 일부러 1.5초 지연시킨다. connection() 으로 요청 시점에 실행되므로 캐시되지 않고,
 * 이 컴포넌트를 감싼 <Suspense> 의 fallback 이 먼저 보인 뒤 결과가 스트리밍된다.
 */
export async function getOtherPosts(excludeId: number): Promise<Post[]> {
  await connection();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const rows = db
    .prepare(`${SELECT_POST} WHERE p.id != ? ORDER BY p.id DESC LIMIT 5`)
    .all(excludeId) as PostRow[];
  return rows.map(toPost);
}

/**
 * 커서 기반 페이지네이션 (무한 스크롤용). Route Handler(/api/posts?cursor=&limit=) 에서 사용.
 * offset 방식(getPostsPage)과 달리 "마지막으로 본 id 보다 작은 것 N개" 를 가져오므로,
 * 스크롤 중에 새 글이 추가되어도 항목이 밀리거나 중복되지 않는다.
 * limit+1 개를 조회해서 다음 페이지가 있는지 판단한다.
 */
export function getPostsByCursor(
  query: string,
  cursor: number | null,
  limit: number,
): { posts: Post[]; nextCursor: number | null } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (query) {
    conditions.push("(p.title LIKE ? OR p.content LIKE ?)");
    params.push(`%${query}%`, `%${query}%`);
  }
  if (cursor !== null) {
    conditions.push("p.id < ?");
    params.push(cursor);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(`${SELECT_POST} ${where} ORDER BY p.id DESC LIMIT ?`)
    .all(...params, limit + 1) as PostRow[];

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(toPost);
  return { posts: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/** 검색. Route Handler(/api/posts) 에서 사용. */
export function searchPosts(query: string): Post[] {
  const rows = db
    .prepare(`${SELECT_POST} WHERE p.title LIKE ? OR p.content LIKE ? ORDER BY p.id DESC`)
    .all(`%${query}%`, `%${query}%`) as PostRow[];
  return rows.map(toPost);
}

export function countPosts(): number {
  const row = db.prepare("SELECT COUNT(*) AS count FROM posts").get() as { count: number };
  return row.count;
}

/**
 * 공개 API(/api/v1/posts) 용 목록. offset 기반 + 전체 개수.
 *
 * getPostsPage() 와 달리 "use cache" 를 쓰지 않는다. 화면은 1분 늦어도 괜찮지만,
 * API 클라이언트는 방금 POST 로 만든 글이 바로 이어서 GET 되기를 기대하기 때문이다.
 * limit/offset 은 호출하는 쪽에서 이미 검증된 값이 들어온다 (schemas/api.ts).
 */
export function listPosts(
  query: string,
  limit: number,
  offset: number,
): { posts: Post[]; total: number } {
  const like = `%${query}%`;
  const where = query ? "WHERE p.title LIKE ? OR p.content LIKE ?" : "";
  const params = query ? [like, like] : [];

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM posts p ${where}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(`${SELECT_POST} ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as PostRow[];

  return { posts: rows.map(toPost), total };
}

/** 캐시되지 않는 단건 조회. getPost() 의 API 판. */
export function findPost(id: number): Post | null {
  const row = db.prepare(`${SELECT_POST} WHERE p.id = ?`).get(id) as PostRow | undefined;
  return row ? toPost(row) : null;
}

// ---------------------------------------------------------------------------
// 변경. 권한 검사(작성자 본인인지)는 호출하는 Server Action 에서 한다.
// ---------------------------------------------------------------------------

export function createPost(
  title: string,
  content: string,
  authorId: number,
  imagePath: string | null = null,
): Post {
  const row = db
    .prepare("INSERT INTO posts (title, content, author_id, image_path) VALUES (?, ?, ?, ?) RETURNING id")
    .get(title, content, authorId, imagePath) as { id: number };
  const full = db.prepare(`${SELECT_POST} WHERE p.id = ?`).get(row.id) as PostRow;
  return toPost(full);
}

export function updatePost(
  id: number,
  title: string,
  content: string,
  imagePath: string | null,
): void {
  db.prepare(
    "UPDATE posts SET title = ?, content = ?, image_path = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(title, content, imagePath, id);
}

export function deletePost(id: number): boolean {
  const result = db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}
