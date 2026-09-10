// persist 스토어의 localStorage 복원을 "마운트 후" 에 실행한다 (클라이언트 컴포넌트, 화면에는 아무것도 안 그림).
// 루트 레이아웃에 한 번만 둔다. 서버 HTML 과 첫 hydration 은 빈 상태로 일치시키고, 그다음에 저장된 값을 불러온다.
"use client";

import { useEffect } from "react";
import { useRecentlyViewed } from "@/stores/recently-viewed-store";

export function StoreHydrator() {
  useEffect(() => {
    useRecentlyViewed.persist.rehydrate();
  }, []);
  return null;
}
