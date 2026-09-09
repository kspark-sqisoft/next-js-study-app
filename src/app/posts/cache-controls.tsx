// 캐시 무효화 방식 두 가지를 비교해 보는 버튼 (클라이언트 컴포넌트).
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  refreshPostsInBackgroundAction,
  refreshPostsNowAction,
} from "./actions";

export function CacheControls() {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await refreshPostsNowAction();
            toast.success("updateTag: 캐시를 즉시 만료했습니다. 시각이 바로 바뀝니다.");
          })
        }
      >
        즉시 갱신 (updateTag)
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await refreshPostsInBackgroundAction();
            toast.info(
              "revalidateTag(max): 이번엔 기존 캐시가 보이고, 한 번 더 새로고침하면 새 시각이 보입니다.",
            );
          })
        }
      >
        백그라운드 갱신 (revalidateTag)
      </Button>
    </div>
  );
}
