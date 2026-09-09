// comments 테이블 접근 함수. 2단 댓글: 최상위 댓글(parent_id NULL) 과 그 아래 답글.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

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

type CommentRow = {
  id: number;
  post_id: number;
  parent_id: number | null;
  author_id: number;
  author_name: string;
  content: string;
  created_at: string;
};

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
  };
}

/** 글의 댓글 태그. 댓글이 바뀌면 이 태그로 무효화한다. */
export function commentsTag(postId: number): string {
  return `post-${postId}-comments`;
}

/**
 * 글 하나의 댓글 전체를 2단 트리로 돌려준다. "use cache" 로 캐시되고,
 * 댓글 추가/삭제 액션이 updateTag(commentsTag(postId)) 로 무효화한다.
 * "누가 삭제할 수 있는지" 는 여기서 판단하지 않는다. 로그인 사용자는 요청마다 다른데
 * 이 결과는 모두가 공유하는 캐시이기 때문이다. 화면 쪽에서 현재 사용자와 authorId 를 비교한다.
 */
export async function getCommentThreads(postId: number): Promise<CommentThread[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(commentsTag(postId));

  const rows = db
    .prepare(
      `SELECT c.*, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id = ?
       ORDER BY c.id ASC`,
    )
    .all(postId) as CommentRow[];

  // 한 번의 쿼리로 가져온 평탄한 목록을 트리로 조립한다
  const threads = new Map<number, CommentThread>();
  const replies: Comment[] = [];
  for (const row of rows) {
    const comment = toComment(row);
    if (comment.parentId === null) threads.set(comment.id, { ...comment, replies: [] });
    else replies.push(comment);
  }
  for (const reply of replies) {
    threads.get(reply.parentId!)?.replies.push(reply);
  }
  return [...threads.values()];
}

/**
 * 공개 API(/api/v1/posts/:id/comments) 용 목록. 캐시하지 않고 평탄한 배열로 돌려준다.
 *
 * 화면용 getCommentThreads() 는 트리로 조립하지만, API 는 parentId 를 그대로 노출하고
 * 조립은 클라이언트에 맡긴다. 그래야 페이지네이션이 성립한다
 * (트리를 자르면 "부모 없는 답글" 이 생겨 버린다).
 */
export function listComments(
  postId: number,
  limit: number,
  offset: number,
): { comments: Comment[]; total: number } {
  const { total } = db
    .prepare("SELECT COUNT(*) AS total FROM comments WHERE post_id = ?")
    .get(postId) as { total: number };

  const rows = db
    .prepare(
      `SELECT c.*, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id = ?
       ORDER BY c.id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(postId, limit, offset) as CommentRow[];

  return { comments: rows.map(toComment), total };
}

export function findComment(id: number): Comment | null {
  const row = db
    .prepare(
      `SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
    )
    .get(id) as CommentRow | undefined;
  return row ? toComment(row) : null;
}

export function createComment(
  postId: number,
  authorId: number,
  content: string,
  parentId: number | null,
): number {
  const row = db
    .prepare(
      "INSERT INTO comments (post_id, parent_id, author_id, content) VALUES (?, ?, ?, ?) RETURNING id",
    )
    .get(postId, parentId, authorId, content) as { id: number };
  return row.id;
}

/** 삭제. 최상위 댓글을 지우면 ON DELETE CASCADE 로 답글도 함께 지워진다. */
export function deleteComment(id: number): boolean {
  const result = db.prepare("DELETE FROM comments WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}
