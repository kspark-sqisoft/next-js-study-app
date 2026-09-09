// 댓글 삭제 버튼 (클라이언트 컴포넌트). 본인 댓글에만 렌더링되지만, 서버 액션이 다시 검사한다.
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteCommentAction } from "../actions";

export function DeleteCommentButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="xs"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteCommentAction(id);
          if (result?.error) toast.error(result.error);
        })
      }
    >
      삭제
    </Button>
  );
}
