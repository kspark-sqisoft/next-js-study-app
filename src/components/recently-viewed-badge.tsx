// 헤더에 최근 본 글 개수를 표시 (클라이언트 컴포넌트). 글 상세 위젯과 같은 스토어를 본다.
"use client";

import { useRecentlyViewed } from "@/stores/recently-viewed-store";

export function RecentlyViewedBadge() {
  const count = useRecentlyViewed((s) => (s.hydrated ? s.entries.length : 0));
  if (count === 0) return null; // 서버 렌더링과 복원 전에는 0 → 아무것도 안 그려 hydration 불일치가 없다
  return (
    <span
      className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary"
      title="최근 본 글"
      data-testid="recent-badge"
    >
      {count}
    </span>
  );
}
