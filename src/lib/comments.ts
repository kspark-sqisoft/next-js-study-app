// comments 테이블 접근 함수 (Prisma 버전). 2단 댓글: 최상위 댓글(parentId null) 과 그 아래 답글.
//
// [main 과 비교]
// - `JOIN users u ON u.id = c.author_id` → `include: { author: { select: { name: true } } }`
//   스키마에 `author User @relation(...)` 을 선언해 두었기 때문에 "관계를 따라가라" 고만 말하면 된다.
// - CommentRow 타입 → Prisma.CommentGetPayload<{ include }> 로 "author 를 include 한 Comment" 타입을 자동 생성.
// - `ON DELETE CASCADE` 는 SQL 이 아니라 schema.prisma 의 `onDelete: Cascade` 에 있다. 동작은 같다.
//
// "use cache" / cacheTag 의 역할은 main 과 완전히 같다 (README 2-3, 3-5).
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client"; // 생성된 타입 네임스페이스 (WhereInput, Include 등)

// 앱에서 쓰는 댓글 타입. main 과 동일.
export type Comment = {
  id: number;
  postId: number;
  parentId: number | null;
  authorId: number;
  authorName: string;
  content: string;
  createdAt: string;
};

// 화면에 그리기 좋은 형태: 최상위 댓글마다 replies 배열
export type CommentThread = Comment & { replies: Comment[] };

// "작성자 이름까지 같이 가져와라" 는 include 옵션. SQL 의 JOIN 에 해당.
// satisfies 로 타입을 검사받되, 값 자체는 리터럴로 유지해 아래 GetPayload 에 넘긴다.
const withAuthor = { author: { select: { name: true } } } satisfies Prisma.CommentInclude;
// 위 include 로 조회했을 때의 행 타입. 손으로 적던 CommentRow 를 Prisma 가 대신 만들어 준다.
type CommentWithAuthor = Prisma.CommentGetPayload<{ include: typeof withAuthor }>;

// Prisma 행 → 앱 타입. 컬럼은 이미 camelCase 라 이름 변환은 없고, 중첩된 author.name 만 평탄하게 편다.
function toComment(c: CommentWithAuthor): Comment {
  return {
    id: c.id,
    postId: c.postId,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.author.name, // include 덕분에 c.author 가 존재한다 (타입도 안다)
    content: c.content,
    createdAt: c.createdAt,
  };
}

/** 글의 댓글 캐시 태그. 댓글이 바뀌면 이 태그로 무효화한다. */
export function commentsTag(postId: number): string {
  return `post-${postId}-comments`;
}

/**
 * 글 하나의 댓글 전체를 2단 트리로 돌려준다. "use cache" 로 캐시되고,
 * 댓글 추가/삭제 액션이 updateTag(commentsTag(postId)) 로 무효화한다.
 * main: SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.author_id WHERE c.post_id = ? ORDER BY c.id ASC
 */
export async function getCommentThreads(postId: number): Promise<CommentThread[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(commentsTag(postId));

  const rows = await prisma.comment.findMany({ where: { postId }, include: withAuthor, orderBy: { id: "asc" } });

  // 한 번의 쿼리로 가져온 평탄한 목록을 트리로 조립 (main 과 같은 로직)
  const threads = new Map<number, CommentThread>();
  const replies: Comment[] = [];
  for (const row of rows) {
    const comment = toComment(row);
    if (comment.parentId === null) threads.set(comment.id, { ...comment, replies: [] });
    else replies.push(comment);
  }
  for (const reply of replies) threads.get(reply.parentId!)?.replies.push(reply);
  return [...threads.values()];
}

/**
 * 공개 API(/api/v1/posts/:id/comments)용. 캐시 없이 offset 페이지네이션.
 * main: SELECT COUNT(*) ... / SELECT ... LIMIT ? OFFSET ?
 */
export async function listComments(postId: number, limit: number, offset: number): Promise<{ comments: Comment[]; total: number }> {
  const [total, rows] = await Promise.all([
    prisma.comment.count({ where: { postId } }),
    prisma.comment.findMany({ where: { postId }, include: withAuthor, orderBy: { id: "asc" }, take: limit, skip: offset }),
  ]);
  return { comments: rows.map(toComment), total };
}

// main: SELECT c.*, u.name AS author_name FROM comments c JOIN users u ... WHERE c.id = ?
export async function findComment(id: number): Promise<Comment | null> {
  if (!Number.isInteger(id)) return null; // NaN 방어
  const c = await prisma.comment.findUnique({ where: { id }, include: withAuthor });
  return c ? toComment(c) : null;
}

// main: INSERT INTO comments (post_id, parent_id, author_id, content) VALUES (?, ?, ?, ?) RETURNING id
export async function createComment(postId: number, authorId: number, content: string, parentId: number | null): Promise<number> {
  // 외래키 컬럼(postId, authorId, parentId)에 id 를 직접 넣는다. `post: { connect: { id } }` 형태로도 쓸 수 있다.
  const c = await prisma.comment.create({ data: { postId, authorId, content, parentId } });
  return c.id;
}

/**
 * 삭제. 최상위 댓글을 지우면 스키마의 onDelete: Cascade 로 답글도 함께 지워진다.
 * main: DELETE FROM comments WHERE id = ?  (CASCADE 는 CREATE TABLE 의 REFERENCES ... ON DELETE CASCADE)
 */
export async function deleteComment(id: number): Promise<boolean> {
  const r = await prisma.comment.deleteMany({ where: { id } }); // 없어도 예외 없이 count 0
  return r.count > 0;
}
