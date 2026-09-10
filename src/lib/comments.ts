// comments 테이블 접근 함수 (Prisma 버전). 2단 댓글: 최상위 댓글(parentId null) 과 그 아래 답글.
// main 브랜치의 `JOIN users u ON u.id = c.author_id` 가 `include: { author: { select: { name } } }` 로 바뀌었다.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type Comment = {
  id: number;
  postId: number;
  parentId: number | null;
  authorId: number;
  authorName: string;
  content: string;
  createdAt: string;
};

export type CommentThread = Comment & { replies: Comment[] };

const withAuthor = { author: { select: { name: true } } } satisfies Prisma.CommentInclude;
type CommentWithAuthor = Prisma.CommentGetPayload<{ include: typeof withAuthor }>;

function toComment(c: CommentWithAuthor): Comment {
  return {
    id: c.id,
    postId: c.postId,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.author.name,
    content: c.content,
    createdAt: c.createdAt,
  };
}

export function commentsTag(postId: number): string {
  return `post-${postId}-comments`;
}

export async function getCommentThreads(postId: number): Promise<CommentThread[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(commentsTag(postId));

  const rows = await prisma.comment.findMany({ where: { postId }, include: withAuthor, orderBy: { id: "asc" } });

  // 평탄한 목록을 2단 트리로 조립 (main 브랜치와 같은 로직)
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

export async function listComments(postId: number, limit: number, offset: number): Promise<{ comments: Comment[]; total: number }> {
  const [total, rows] = await Promise.all([
    prisma.comment.count({ where: { postId } }),
    prisma.comment.findMany({ where: { postId }, include: withAuthor, orderBy: { id: "asc" }, take: limit, skip: offset }),
  ]);
  return { comments: rows.map(toComment), total };
}

export async function findComment(id: number): Promise<Comment | null> {
  if (!Number.isInteger(id)) return null;
  const c = await prisma.comment.findUnique({ where: { id }, include: withAuthor });
  return c ? toComment(c) : null;
}

export async function createComment(postId: number, authorId: number, content: string, parentId: number | null): Promise<number> {
  const c = await prisma.comment.create({ data: { postId, authorId, content, parentId } });
  return c.id;
}

/** 삭제. 최상위 댓글을 지우면 스키마의 onDelete: Cascade 로 답글도 함께 지워진다. */
export async function deleteComment(id: number): Promise<boolean> {
  const r = await prisma.comment.deleteMany({ where: { id } });
  return r.count > 0;
}
