// posts 테이블 접근 함수 (Prisma 버전). "use cache" 와 connection() 의 역할은 main 브랜치와 같다.
//
// main 브랜치와 비교해서 볼 것:
// - `LEFT JOIN users` SQL 이 `include: { author: { select: { name: true } } }` 로 바뀌었다.
// - 검색 조건 문자열 조립(`WHERE p.title LIKE ? OR ...`)이 객체(`OR: [{ title: { contains } }, ...]`)로 바뀌었다.
// - 커서 조건 `p.id < ?` 가 `id: { lt: cursor }` 로 바뀌었다.
// - PostRow 타입이 사라지고 Prisma 가 생성한 타입을 쓴다. 컬럼 이름 오타는 컴파일 에러가 된다.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { sqlNow } from "@/lib/sql-now";
import type { Prisma } from "@/generated/prisma/client";

export type Post = {
  id: number;
  title: string;
  content: string;
  authorId: number | null;
  authorName: string | null;
  imagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

// 작성자 이름까지 함께 가져오는 공통 include. SQL 의 LEFT JOIN 에 해당한다.
// (author 가 없을 수 있는 글(authorId NULL)은 author 가 null 로 온다 → LEFT JOIN 과 같은 의미)
const withAuthor = { author: { select: { name: true } } } satisfies Prisma.PostInclude;
// 위 include 로 조회했을 때의 행 타입. main 의 PostRow 를 손으로 적을 필요가 없다.
type PostWithAuthor = Prisma.PostGetPayload<{ include: typeof withAuthor }>;

function toPost(p: PostWithAuthor): Post {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    authorId: p.authorId,
    authorName: p.author?.name ?? null,
    imagePath: p.imagePath,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// 검색 조건. SQL 의 `title LIKE '%q%' OR content LIKE '%q%'`
// 조건을 "객체" 로 만들어 두면 count 와 findMany 에 같은 것을 넘길 수 있고, 다른 조건과 AND 로 합치기도 쉽다.
function searchWhere(query: string): Prisma.PostWhereInput {
  return query ? { OR: [{ title: { contains: query } }, { content: { contains: query } }] } : {};
}

// ---------------------------------------------------------------------------
// 캐시되는 조회 (ISR)
// ---------------------------------------------------------------------------

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
 * 검색 + 페이지네이션 목록 (/posts). "use cache", cacheLife, cacheTag 의 역할은 main 과 같다 (README 2-2, 2-9).
 * main: SELECT COUNT(*) ... WHERE ...  /  SELECT p.*, u.name ... LEFT JOIN users ... ORDER BY p.id DESC LIMIT ? OFFSET ?
 */
export async function getPostsPage(query: string, page: number): Promise<PostsPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag("posts");

  const where = searchWhere(query);
  const total = await prisma.post.count({ where }); // COUNT(*)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const rows = await prisma.post.findMany({
    where,
    include: withAuthor, // 작성자 이름 JOIN
    orderBy: { id: "desc" },
    take: PAGE_SIZE, // LIMIT
    skip: (safePage - 1) * PAGE_SIZE, // OFFSET
  });

  return { posts: rows.map(toPost), total, page: safePage, totalPages, query, cachedAt: new Date().toISOString() };
}

/**
 * 글 한 건. id 별로 별도 캐시 엔트리 (main 과 같다).
 * main: SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.id = ?
 */
export async function getPost(id: number): Promise<Post | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("posts", `post-${id}`);

  if (!Number.isInteger(id)) return null; // NaN 등은 Prisma 가 거부하므로(SQLite 는 빈 결과) 먼저 걸러 같은 동작을 유지
  const p = await prisma.post.findUnique({ where: { id }, include: withAuthor });
  return p ? toPost(p) : null;
}

// ---------------------------------------------------------------------------
// 캐시되지 않는 조회
// ---------------------------------------------------------------------------

/** generateStaticParams 용. main: SELECT id FROM posts ORDER BY id DESC */
export async function getPostIds(): Promise<number[]> {
  // select 로 id 만 고르면 반환 타입도 { id: number }[] 로 좁혀진다
  const rows = await prisma.post.findMany({ select: { id: true }, orderBy: { id: "desc" } });
  return rows.map((r) => r.id);
}

/**
 * 스트리밍 데모용 (1.5초 지연). connection() 으로 요청 시점에 실행 (main 과 같다).
 * main: ... WHERE p.id != ? ORDER BY p.id DESC LIMIT 5
 */
export async function getOtherPosts(excludeId: number): Promise<Post[]> {
  await connection();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const rows = await prisma.post.findMany({
    where: { id: { not: excludeId } }, // != 는 not
    include: withAuthor,
    orderBy: { id: "desc" },
    take: 5,
  });
  return rows.map(toPost);
}

/**
 * 커서 페이지네이션 (무한 스크롤). main 에서는 조건 문자열 배열을 " AND " 로 join 했다.
 * main: WHERE (p.title LIKE ? OR p.content LIKE ?) AND p.id < ? ORDER BY p.id DESC LIMIT ?
 */
export async function getPostsByCursor(
  query: string,
  cursor: number | null,
  limit: number,
): Promise<{ posts: Post[]; nextCursor: number | null }> {
  const rows = await prisma.post.findMany({
    // AND 배열: 검색 조건 + 커서 조건. 커서가 없으면 빈 객체(조건 없음). `lt` = less than (<)
    where: { AND: [searchWhere(query), cursor === null ? {} : { id: { lt: cursor } }] },
    include: withAuthor,
    orderBy: { id: "desc" },
    take: limit + 1, // 하나 더 읽어서 다음 페이지가 있는지 판단
  });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(toPost);
  return { posts: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

// 검색 (Route Handler 용). main: ... WHERE p.title LIKE ? OR p.content LIKE ? ORDER BY p.id DESC
export async function searchPosts(query: string): Promise<Post[]> {
  const rows = await prisma.post.findMany({ where: searchWhere(query), include: withAuthor, orderBy: { id: "desc" } });
  return rows.map(toPost);
}

// main: SELECT COUNT(*) AS count FROM posts
export async function countPosts(): Promise<number> {
  return prisma.post.count();
}

/** 공개 API(/api/v1/posts)용. getPostsPage 와 같은 쿼리지만 캐시가 없다 (README 5-8). */
export async function listPosts(query: string, limit: number, offset: number): Promise<{ posts: Post[]; total: number }> {
  const where = searchWhere(query);
  const [total, rows] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({ where, include: withAuthor, orderBy: { id: "desc" }, take: limit, skip: offset }),
  ]);
  return { posts: rows.map(toPost), total };
}

/** 공개 API 용 단건 (캐시 없음). getPost 와 쿼리는 같다. */
export async function findPost(id: number): Promise<Post | null> {
  if (!Number.isInteger(id)) return null;
  const p = await prisma.post.findUnique({ where: { id }, include: withAuthor });
  return p ? toPost(p) : null;
}

// ---------------------------------------------------------------------------
// 변경. 권한 검사(작성자 본인인지)는 호출하는 Server Action / Route Handler 에서 한다.
// ---------------------------------------------------------------------------

/**
 * 글 작성. main 은 INSERT ... RETURNING id 뒤에 SELECT 를 한 번 더 했다.
 * Prisma 의 create 는 include 를 함께 주면 만든 행을 작성자까지 붙여 한 번에 돌려준다.
 */
export async function createPost(
  title: string,
  content: string,
  authorId: number,
  imagePath: string | null = null,
): Promise<Post> {
  const p = await prisma.post.create({ data: { title, content, authorId, imagePath }, include: withAuthor });
  return toPost(p);
}

/**
 * 글 수정. main: UPDATE posts SET title = ?, content = ?, image_path = ?, updated_at = datetime('now') WHERE id = ?
 * Prisma 의 update 는 SQL 함수(datetime('now'))를 직접 못 부르므로, 같은 형식의 문자열을 sqlNow() 로 만들어 넣는다.
 * (새 프로젝트라면 DateTime 타입 + @updatedAt 으로 자동 갱신하게 한다)
 */
export async function updatePost(id: number, title: string, content: string, imagePath: string | null): Promise<void> {
  await prisma.post.update({ where: { id }, data: { title, content, imagePath, updatedAt: sqlNow() } });
}

// main: DELETE FROM posts WHERE id = ?  (댓글은 ON DELETE CASCADE)
export async function deletePost(id: number): Promise<boolean> {
  const r = await prisma.post.deleteMany({ where: { id } }); // comments 는 스키마의 onDelete: Cascade 로 함께 삭제. 없으면 count 0
  return r.count > 0;
}
