// 라우트 모달 껍데기 (클라이언트 컴포넌트). 인터셉팅 라우트 페이지가 이 안에 내용을 넣는다.
// 닫기 = router.back(): 모달을 "열었던" 것이 곧 URL 이동이었으므로, 뒤로 가면 이전 목록 URL 로 돌아가며 모달이 사라진다.
// 브라우저 뒤로/앞으로 버튼과도 자연스럽게 맞물린다 (뒤로 → 닫힘, 앞으로 → 다시 열림).
"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function RouteModal({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back(); // ESC, 바깥 클릭, X 버튼 모두 여기로 온다
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
        <DialogTitle>{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
