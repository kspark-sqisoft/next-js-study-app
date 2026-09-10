// 댓글 삭제 버튼 (클라이언트 컴포넌트) — tRPC useMutation 버전. 본인 댓글에만 렌더링되지만 서버 프로시저가 다시 검사한다.
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

export function DeleteCommentButton({ id, postId }: { id: number; postId: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const remove = useMutation(
    trpc.comments.remove.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.comments.list.queryFilter({ postId })),
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <Button
      size="xs"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={remove.isPending}
      onClick={() => remove.mutate({ id })}
    >
      삭제
    </Button>
  );
}
