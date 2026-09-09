// "완료 항목 삭제" 버튼 (클라이언트 컴포넌트).
// 버튼 클릭 이벤트에서 Server Action 을 호출하는 가장 단순한 예.
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearCompletedAction } from "./actions";

export function ClearCompletedButton({ count }: { count: number }) {
  const [isPending, startTransition] = useTransition();

  // 완료된 항목이 없으면 버튼 자체를 숨긴다
  if (count === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const deleted = await clearCompletedAction(); // 서버에서 삭제 후 개수 반환
          toast.success(`완료된 할 일 ${deleted}개를 삭제했습니다.`);
        })
      }
    >
      완료 항목 삭제 ({count})
    </Button>
  );
}
