// error.tsx 데모용 버튼 (클라이언트 컴포넌트).
// 렌더링 중에 throw 하면 가장 가까운 Error Boundary(src/app/posts/error.tsx) 가 잡는다.
// 이벤트 핸들러 안에서 던진 에러는 Error Boundary 가 잡지 못하므로, 상태를 바꿔 렌더 단계에서 던진다.
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ErrorTrigger() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error("error.tsx 데모용으로 일부러 발생시킨 에러입니다.");
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setShouldThrow(true)}>
      에러 발생시키기 (error.tsx)
    </Button>
  );
}
