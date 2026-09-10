// 댓글/답글 작성 폼 (클라이언트 컴포넌트) — tRPC useMutation 버전.
//
// [main 브랜치와 비교]
// main: <form action={formAction}> + useActionState(addCommentAction) 였다. 제출하면 Server Action 이 실행되고,
//       액션이 updateTag 로 서버 캐시를 지운 뒤 Next.js 가 페이지를 다시 렌더링해 새 목록이 내려왔다.
// 여기: <form onSubmit> 에서 useMutation 의 mutate 를 부른다. 프로시저가 서버 캐시를 revalidateTag 로 지우고,
//       onSuccess 에서 브라우저 캐시를 invalidateQueries 로 지우면 목록 쿼리만 다시 가져온다. 페이지 재렌더링은 없다.
//
// [캐시 두 층을 둘 다 지워야 하는 이유]
// - 서버 "use cache"(getCommentThreads) 만 지우면: 브라우저 캐시가 아직 신선(staleTime 안)해서 재요청을 안 한다 → 화면 그대로.
// - 브라우저 캐시만 지우면: 재요청은 나가지만 서버가 옛 캐시를 돌려준다 → 화면 그대로.
// 프로시저(서버 층)와 onSuccess(브라우저 층)가 각자 자기 층을 맡는다.
"use client";

import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";

type Props = { postId: number; parentId: number | null; placeholder: string };

export function CommentForm({ postId, parentId, placeholder }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // mutationOptions() 가 mutationKey 와 mutationFn(→ POST /api/trpc/comments.add) 을 만들어 준다.
  // add.mutate(입력) 의 입력 타입은 라우터 add 의 .input(zod) 에서 온다. 필드를 빠뜨리면 컴파일 에러.
  const add = useMutation(
    trpc.comments.add.mutationOptions({
      // queryFilter({ postId }): "이 글의 댓글 목록" 쿼리 키만 고르는 필터. 다른 글의 캐시는 건드리지 않는다.
      // invalidateQueries 는 그 쿼리를 "낡음" 으로 표시하고, 화면에 마운트된 useQuery 가 있으면 즉시 재요청한다.
      onSuccess: () => queryClient.invalidateQueries(trpc.comments.list.queryFilter({ postId })),
      // 서버가 throw 한 TRPCError 의 message("로그인이 필요합니다.", "답글을 달 수 없는 댓글입니다." 등)가 그대로 온다.
      // main 은 액션이 { error } 를 돌려주면 useEffect 에서 toast 를 띄웠다.
      onError: (err) => toast.error(err.message),
    }),
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const content = String(new FormData(form).get("content") ?? "");
    // mutate(입력, 이 호출에만 적용되는 옵션). 위 mutationOptions 의 onSuccess(캐시 무효화)와 여기의 onSuccess(폼 비우기)가 둘 다 실행된다.
    // 폼 비우기를 여기 둔 이유: 렌더링 중에 만들어지는 mutationOptions 안에서 ref.current 를 읽으면 react-hooks/refs 린트가 거부한다.
    add.mutate({ postId, parentId, content }, { onSuccess: () => form.reset() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      {/* add.isPending: 요청이 진행 중인 동안 true. main 의 useActionState 가 주던 pending 과 같은 역할 */}
      <Textarea name="content" rows={2} placeholder={placeholder} maxLength={1000} disabled={add.isPending} className="flex-1" />
      <Button type="submit" size="sm" disabled={add.isPending} className="self-end">
        {parentId === null ? "댓글 작성" : "답글 작성"}
      </Button>
    </form>
  );
}
