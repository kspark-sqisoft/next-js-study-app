// "답글 쓰기" 를 눌렀을 때만 폼을 보여 주는 작은 클라이언트 컴포넌트.
// children(서버에서 만든 CommentForm)을 그대로 통과시킨다.
"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ReplyToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <Button size="xs" variant="ghost" onClick={() => setOpen((v) => !v)}>
        {open ? "답글 닫기" : "답글 쓰기"}
      </Button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
