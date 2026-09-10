// 댓글 삭제 버튼 (클라이언트 컴포넌트) — tRPC useMutation 버전.
// comment-threads.tsx 가 "내 댓글" 에만 이 버튼을 그리지만, 그것은 화면 편의일 뿐이다.
// 실제 권한은 routers/comments.ts 의 remove 프로시저가 세션의 사용자(ctx.user)로 다시 검사한다.
//
// main 브랜치: useTransition + deleteCommentAction(Server Action). 액션이 { error } 를 돌려주면 toast.
// 여기: useMutation + 프로시저. 서버가 FORBIDDEN 을 던지면 onError 로 온다. 구조는 comment-form.tsx 와 같다.
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

export function DeleteCommentButton({ id, postId }: { id: number; postId: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient(); // TRPCReactProvider 가 제공하는 브라우저 QueryClient
  const remove = useMutation(
    trpc.comments.remove.mutationOptions({
      // 성공하면 이 글의 댓글 목록 쿼리만 무효화 → comment-threads.tsx 의 useQuery 가 재요청해 삭제가 화면에 반영된다.
      // postId 를 props 로 받는 이유: 어느 글의 목록을 무효화할지 queryFilter 에 알려 줘야 하기 때문.
      onSuccess: () => queryClient.invalidateQueries(trpc.comments.list.queryFilter({ postId })),
      onError: (err) => toast.error(err.message), // "본인이 쓴 댓글만 삭제할 수 있습니다." 등 서버 메시지 그대로
    }),
  );

  return (
    <Button
      size="xs"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={remove.isPending} // 요청 중 중복 클릭 방지
      onClick={() => remove.mutate({ id })} // 입력 { id } 의 타입은 라우터 remove 의 .input 에서 온다
    >
      삭제
    </Button>
  );
}
