// 댓글 영역 (서버 컴포넌트) — tRPC 버전.
// main 브랜치: 서버 컴포넌트가 getCommentThreads() 로 목록을 읽어 그대로 그렸다 (Server Action 으로 변경).
// 이 브랜치: 서버 컴포넌트는 (1) 세션에서 현재 사용자를 읽고 (2) tRPC 프로시저를 prefetch 해 캐시에 채운 뒤
// (3) HydrateClient 로 그 캐시를 브라우저에 넘긴다. 실제 렌더링은 클라이언트 컴포넌트(CommentThreads)가
// useQuery 로 한다. 댓글을 추가/삭제하면 useMutation 의 onSuccess 가 목록 쿼리를 무효화해 다시 가져온다.
import { getCurrentUser } from "@/lib/dal";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { CommentThreads } from "./comment-threads";

export async function CommentsSection({ postId }: { postId: number }) {
  const user = await getCurrentUser(); // 요청 시점 (Suspense 안에서 호출됨)
  // await 하지 않는다. 서버에서 라우터를 직접 호출해 QueryClient 를 채우고, 결과는 HydrateClient 가 스트리밍한다.
  prefetch(trpc.comments.list.queryOptions({ postId }));

  return (
    <HydrateClient>
      <CommentThreads postId={postId} currentUserId={user?.id ?? null} />
    </HydrateClient>
  );
}
