// 댓글 영역 (서버 컴포넌트) — tRPC 버전. 글 상세 page.tsx 가 <Suspense> 안에서 렌더링한다.
//
// [main 브랜치와 비교]
// main: 서버 컴포넌트가 getCommentThreads() 와 getCurrentUser() 를 await 해서 목록을 직접 그렸다.
//       댓글을 추가하면 Server Action 이 updateTag 로 서버 캐시를 지우고, revalidatePath 로 페이지를 다시 렌더링했다.
// 여기: 서버 컴포넌트는 (1) 세션에서 현재 사용자를 읽고 (2) tRPC 프로시저를 prefetch 해 서버 QueryClient 에 채운 뒤
//       (3) HydrateClient 로 그 캐시를 브라우저에 넘긴다. 실제 렌더링은 클라이언트 컴포넌트(CommentThreads)가 useQuery 로 한다.
//       댓글을 추가/삭제하면 useMutation 의 onSuccess 가 브라우저 캐시를 무효화해 목록만 다시 가져온다 (페이지 전체 재렌더링 없음).
//
// [역할 분담]
// - 서버 컴포넌트(이 파일): 세션 읽기(cookies 는 서버에서만), 첫 데이터 prefetch, hydrate 경계 만들기
// - 클라이언트 컴포넌트(comment-threads.tsx): 캐시에서 데이터 읽어 그리기, 이후 갱신 반응
import { getCurrentUser } from "@/lib/dal";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { CommentThreads } from "./comment-threads";

export async function CommentsSection({ postId }: { postId: number }) {
  // 세션(쿠키) 읽기는 요청 시점 작업이라 Cache Components 규칙상 Suspense 안이어야 한다 (page.tsx 가 감싼다).
  // 현재 사용자 id 를 클라이언트에 넘기는 이유: "내 댓글에만 삭제 버튼" 을 그리기 위해서. 표시용일 뿐이고
  // 실제 삭제 권한은 routers/comments.ts 의 remove 프로시저가 ctx.user 로 다시 검사한다.
  const user = await getCurrentUser();

  // prefetch: 서버에서 라우터를 직접 호출(HTTP 없음)해 서버 QueryClient 를 채운다. await 하지 않는다.
  // 기다리면 이 컴포넌트가 데이터 도착까지 멈추지만, 기다리지 않으면 pending 상태 그대로 HydrateClient 가
  // 스트리밍하고 결과가 오는 대로 브라우저에서 채워진다 (server.tsx 의 설명 참고).
  prefetch(trpc.comments.list.queryOptions({ postId }));

  return (
    // 이 경계 안의 클라이언트 컴포넌트가 쓰는 useQuery 는 위에서 채운 데이터로 시작한다 → 첫 렌더링에 로딩 없음
    <HydrateClient>
      <CommentThreads postId={postId} currentUserId={user?.id ?? null} />
    </HydrateClient>
  );
}
