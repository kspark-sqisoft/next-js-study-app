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
const withAuthor = { author: { select: { name: true } } } satisfies Prisma.PostInclude;
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

// 검색 조건. SQL 의 `title LIKE ? OR content LIKE ?`
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

export async function getPostsPage(query: string, page: number): Promise<PostsPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag("posts");

  const where = searchWhere(query);
  const total = await prisma.post.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const rows = await prisma.post.findMany({
    where,
    include: withAuthor,
    orderBy: { id: "desc" },
    take: PAGE_SIZE,
    skip: (safePage - 1) * PAGE_SIZE,
  });

  return { posts: rows.map(toPost), total, page: safePage, totalPages, query, cachedAt: new Date().toISOString() };
}

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

export async function getPostIds(): Promise<number[]> {
  const rows = await prisma.post.findMany({ select: { id: true }, orderBy: { id: "desc" } });
  return rows.map((r) => r.id);
}

export async function getOtherPosts(excludeId: number): Promise<Post[]> {
  await connection();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const rows = await prisma.post.findMany({
    where: { id: { not: excludeId } },
    include: withAuthor,
    orderBy: { id: "desc" },
    take: 5,
  });
  return rows.map(toPost);
}

export async function getPostsByCursor(
  query: string,
  cursor: number | null,
  limit: number,
): Promise<{ posts: Post[]; nextCursor: number | null }> {
  const rows = await prisma.post.findMany({
    where: { AND: [searchWhere(query), cursor === null ? {} : { id: { lt: cursor } }] },
    include: withAuthor,
    orderBy: { id: "desc" },
    take: limit + 1, // 하나 더 읽어서 다음 페이지가 있는지 판단
  });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(toPost);
  return { posts: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

export async function searchPosts(query: string): Promise<Post[]> {
  const rows = await prisma.post.findMany({ where: searchWhere(query), include: withAuthor, orderBy: { id: "desc" } });
  return rows.map(toPost);
}

export async function countPosts(): Promise<number> {
  return prisma.post.count();
}

export async function listPosts(query: string, limit: number, offset: number): Promise<{ posts: Post[]; total: number }> {
  const where = searchWhere(query);
  const [total, rows] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({ where, include: withAuthor, orderBy: { id: "desc" }, take: limit, skip: offset }),
  ]);
  return { posts: rows.map(toPost), total };
}

export async function findPost(id: number): Promise<Post | null> {
  if (!Number.isInteger(id)) return null;
  const p = await prisma.post.findUnique({ where: { id }, include: withAuthor });
  return p ? toPost(p) : null;
}

// ---------------------------------------------------------------------------
// 변경. 권한 검사(작성자 본인인지)는 호출하는 Server Action / Route Handler 에서 한다.
// ---------------------------------------------------------------------------

export async function createPost(
  title: string,
  content: string,
  authorId: number,
  imagePath: string | null = null,
): Promise<Post> {
  const p = await prisma.post.create({ data: { title, content, authorId, imagePath }, include: withAuthor });
  return toPost(p);
}

export async function updatePost(id: number, title: string, content: string, imagePath: string | null): Promise<void> {
  await prisma.post.update({ where: { id }, data: { title, content, imagePath, updatedAt: sqlNow() } });
}

export async function deletePost(id: number): Promise<boolean> {
  const r = await prisma.post.deleteMany({ where: { id } }); // comments 는 스키마의 onDelete: Cascade 로 함께 삭제
  return r.count > 0;
}
