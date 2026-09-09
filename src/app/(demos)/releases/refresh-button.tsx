// 외부 API 캐시를 태그로 무효화하는 버튼. DB 캐시 갱신과 완전히 같은 방식이다.
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshReleasesAction } from "@/app/posts/actions";

export function RefreshReleasesButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await refreshReleasesAction();
          toast.success("릴리스 캐시를 갱신했습니다.");
        })
      }
    >
      다시 가져오기
    </Button>
  );
}
