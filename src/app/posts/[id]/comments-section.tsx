// 댓글 영역 (서버 컴포넌트). 2단 구조: 최상위 댓글 → 답글.
// 댓글 목록은 "use cache" 로 캐시되고(모두 공유), 현재 사용자는 요청마다 읽는다.
// 두 가지를 여기서 합쳐 "내 댓글에만 삭제 버튼" 을 그린다.
import { getCurrentUser } from "@/lib/dal";
import { Avatar } from "@/components/avatar";
import { getCommentThreads, type Comment } from "@/lib/comments";
import { log } from "@/lib/study-log";
import { CommentForm } from "./comment-form";
import { DeleteCommentButton } from "./delete-comment-button";
import { ReplyToggle } from "./reply-toggle";

export async function CommentsSection({ postId }: { postId: number }) {
  // 캐시된 댓글과 요청별 사용자 정보를 동시에 가져온다
  log.render(`CommentsSection(postId=${postId}) → getCommentThreads(캐시, 모두 공유) + getCurrentUser(요청별) 동시 호출`);
  const [threads, user] = await Promise.all([getCommentThreads(postId), getCurrentUser()]);
  log.render(`CommentsSection ← 댓글 스레드 ${threads.length}개, 현재 사용자 ${user ? user.name : "없음"} → 삭제 버튼은 여기서 사용자별로 결정`);
  const currentUserId = user?.id ?? null;
  const total = threads.reduce((n, t) => n + 1 + t.replies.length, 0);

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">댓글 {total}개</h2>

      {threads.length === 0 && (
        <p className="text-sm text-muted-foreground">첫 댓글을 남겨 보세요.</p>
      )}

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
            {user && (
              <ReplyToggle>
                <CommentForm postId={postId} parentId={thread.id} placeholder="답글을 입력하세요" />
              </ReplyToggle>
            )}
          </li>
        ))}
      </ul>

      {user ? (
        <CommentForm postId={postId} parentId={null} placeholder="댓글을 입력하세요" />
      ) : (
        <p className="text-sm text-muted-foreground">댓글을 쓰려면 로그인하세요.</p>
      )}
    </section>
  );
}

function CommentItem({ comment, currentUserId }: { comment: Comment; currentUserId: number | null }) {
  const isMine = currentUserId === comment.authorId;
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar name={comment.authorName} avatarPath={comment.authorAvatar} size="xs" />
        <span className="font-medium text-foreground">{comment.authorName}</span>
        <span>{comment.createdAt}</span>
        {isMine && <DeleteCommentButton id={comment.id} />}
      </div>
      <p className="mt-1 whitespace-pre-line text-sm">{comment.content}</p>
    </div>
  );
}
