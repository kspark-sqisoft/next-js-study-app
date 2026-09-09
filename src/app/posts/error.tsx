// /posts 세그먼트의 Error Boundary.
// 이 파일 아래(page, [id] 등)에서 렌더링 중 에러가 던져지면 페이지 대신 이 UI 가 보인다.
// Error Boundary 는 반드시 클라이언트 컴포넌트여야 한다.
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PostsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void; // 세그먼트를 다시 가져와 렌더링 (복구 시도)
}) {
  useEffect(() => {
    // 실제 서비스라면 여기서 에러 리포팅 서비스로 전송
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
      <h2 className="font-semibold text-destructive">문제가 발생했습니다</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {/* 서버 컴포넌트에서 난 에러는 프로덕션에서 메시지가 감춰지고 digest 만 온다 */}
        {error.message}
        {error.digest && (
          <span className="ml-2 font-mono text-xs">(digest: {error.digest})</span>
        )}
      </p>
      <Button className="mt-4" size="sm" onClick={() => retry()}>
        다시 시도
      </Button>
    </div>
  );
}
