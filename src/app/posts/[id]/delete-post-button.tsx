// 글 삭제 버튼 (클라이언트 컴포넌트). Server Action 호출 후 목록으로 redirect 된다.
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deletePostAction } from "../actions";

export function DeletePostButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("이 글을 삭제할까요?")) return;
        startTransition(async () => {
          const result = await deletePostAction(id);
          if (result?.error) toast.error(result.error);
        });
      }}
    >
      삭제
    </Button>
  );
}
