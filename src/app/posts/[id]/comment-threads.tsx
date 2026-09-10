// 댓글 목록 (클라이언트 컴포넌트, tRPC useQuery).
// 서버에서 prefetch + hydrate 된 상태로 시작하므로 첫 렌더링에 로딩이 없다.
// 이후 추가/삭제 mutation 이 성공하면 invalidateQueries 로 이 쿼리가 다시 실행된다.
"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { Comment } from "@/lib/comments";
import { CommentForm } from "./comment-form";
import { DeleteCommentButton } from "./delete-comment-button";
import { ReplyToggle } from "./reply-toggle";

export function CommentThreads({ postId, currentUserId }: { postId: number; currentUserId: number | null }) {
  const trpc = useTRPC();
  const { data: threads = [], error } = useQuery(trpc.comments.list.queryOptions({ postId }));
  const total = threads.reduce((n, t) => n + 1 + t.replies.length, 0);
  const loggedIn = currentUserId !== null;

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">댓글 {total}개</h2>
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {threads.length === 0 && <p className="text-sm text-muted-foreground">첫 댓글을 남겨 보세요.</p>}

      <ul className="space-y-4">
        {threads.map((thread) => (
          <li key={thread.id} className="rounded-lg border p-3">
            <CommentItem comment={thread} currentUserId={currentUserId} />

            {/* 답글 목록: 왼쪽 들여쓰기로 2단임을 표시 */}
            {thread.replies.length > 0 && (
              <ul className="mt-3 space-y-3 border-l-2 pl-4">
                {thread.replies.map((reply) => (
                  <li key={reply.id}>
                    <CommentItem comment={reply} currentUserId={currentUserId} />
                  </li>
                ))}
              </ul>
            )}

            {/* 답글 쓰기: 로그인한 경우에만. 답글의 답글은 없다(2단 제한) */}
            {loggedIn && (
              <ReplyToggle>
                <CommentForm postId={postId} parentId={thread.id} placeholder="답글을 입력하세요" />
              </ReplyToggle>
            )}
          </li>
        ))}
      </ul>

      {loggedIn ? (
        <CommentForm postId={postId} parentId={null} placeholder="댓글을 입력하세요" />
      ) : (
        <p className="text-sm text-muted-foreground">댓글을 쓰려면 로그인하세요.</p>
      )}
    </section>
  );
}

function CommentItem({ comment, currentUserId }: { comment: Comment; currentUserId: number | null }) {
  const isMine = currentUserId === comment.authorId; // 화면 표시용. 실제 권한 검사는 서버 프로시저가 한다
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{comment.authorName}</span>
        <span>{comment.createdAt}</span>
        {isMine && <DeleteCommentButton id={comment.id} postId={comment.postId} />}
      </div>
      <p className="mt-1 whitespace-pre-line text-sm">{comment.content}</p>
    </div>
  );
}
