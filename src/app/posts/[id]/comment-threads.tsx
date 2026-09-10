// 댓글 목록 (클라이언트 컴포넌트, tRPC useQuery). comments-section.tsx(서버)가 채워 둔 캐시를 읽어 그린다.
//
// [main 브랜치와 비교] main 의 comments-section.tsx 는 서버 컴포넌트 하나가 목록을 그렸고 클라이언트 컴포넌트는
// 폼과 버튼뿐이었다. 여기서는 목록 자체가 클라이언트 컴포넌트다. 이유: 댓글을 추가/삭제한 뒤 페이지를 다시
// 렌더링하지 않고 "이 목록만" 다시 가져오려면, 목록이 TanStack Query 캐시를 구독하고 있어야 한다.
//
// [데이터 흐름]
// 1. 첫 렌더링: 서버가 prefetch + hydrate 한 데이터가 캐시에 있으므로 useQuery 가 즉시 data 를 돌려준다 (로딩 없음).
// 2. 댓글 추가/삭제: comment-form.tsx / delete-comment-button.tsx 의 useMutation 이 성공하면
//    invalidateQueries(trpc.comments.list.queryFilter({ postId })) 로 이 쿼리를 "낡음" 으로 표시 → 자동 재요청 → 화면 갱신.
// 3. 재요청은 /api/trpc/comments.list 로 나가고, 서버의 "use cache" 는 프로시저 안의 revalidateTag 가 이미 지웠으므로 새 목록이 온다.
"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { Comment } from "@/lib/comments";
import { CommentForm } from "./comment-form";
import { DeleteCommentButton } from "./delete-comment-button";
import { ReplyToggle } from "./reply-toggle";

export function CommentThreads({ postId, currentUserId }: { postId: number; currentUserId: number | null }) {
  const trpc = useTRPC();
  // queryOptions({ postId }) 는 서버의 prefetch(trpc.comments.list.queryOptions({ postId })) 와 같은 queryKey 를 만든다.
  // 키가 같아야 hydrate 된 데이터를 찾는다. data 의 타입은 라우터 list 의 반환 타입(CommentThread[]) 이다.
  // `= []` 기본값: 에러 등으로 data 가 undefined 일 때 아래 계산이 깨지지 않게.
  const { data: threads = [], error } = useQuery(trpc.comments.list.queryOptions({ postId }));
  const total = threads.reduce((n, t) => n + 1 + t.replies.length, 0); // 최상위 + 답글 개수
  const loggedIn = currentUserId !== null; // 서버 컴포넌트가 세션에서 읽어 넘긴 값. 폼 표시 여부에만 쓴다

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
  // 화면 표시용 판단. 브라우저에서 currentUserId 를 조작해 버튼을 보이게 해도, 삭제 요청은 서버의 remove 프로시저가
  // ctx.user(세션에서 온 진짜 사용자)로 다시 검사해 FORBIDDEN 을 돌려준다. "버튼 숨김은 편의, 검사는 서버" 원칙.
  const isMine = currentUserId === comment.authorId;
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
