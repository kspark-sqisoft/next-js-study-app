// 댓글/답글 작성 폼 (클라이언트 컴포넌트) — tRPC useMutation 버전.
// main 브랜치: useActionState + Server Action(addCommentAction) + revalidatePath/updateTag.
// 이 브랜치: useMutation(trpc.comments.add.mutationOptions()) → 성공하면 댓글 목록 쿼리를 무효화해 다시 가져온다.
// 서버 캐시("use cache" 된 getCommentThreads)는 프로시저 안의 revalidateTag 가 지운다.
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

  const add = useMutation(
    trpc.comments.add.mutationOptions({
      // 이 글의 댓글 목록 쿼리만 골라서 무효화 → useQuery 가 다시 가져온다
      onSuccess: () => queryClient.invalidateQueries(trpc.comments.list.queryFilter({ postId })),
      onError: (err) => toast.error(err.message), // TRPCError 의 message 가 그대로 온다
    }),
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const content = String(new FormData(form).get("content") ?? "");
    // 입력 타입도 라우터의 .input(zod) 에서 온다. 두 번째 인자의 onSuccess 는 이 호출에만 적용된다
    add.mutate({ postId, parentId, content }, { onSuccess: () => form.reset() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Textarea name="content" rows={2} placeholder={placeholder} maxLength={1000} disabled={add.isPending} className="flex-1" />
      <Button type="submit" size="sm" disabled={add.isPending} className="self-end">
        {parentId === null ? "댓글 작성" : "답글 작성"}
      </Button>
    </form>
  );
}
