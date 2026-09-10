// 브라우저 전용 컴포넌트: zustand persist 스토어에 "최근 본 글" 을 기록하고 보여 준다.
// 저장/불러오기는 스토어(src/stores/recently-viewed-store.ts)가 맡는다. 이 컴포넌트는 기록하고 그리기만 한다.
// next/dynamic 의 ssr:false 로만 로드되므로 서버 HTML 에는 없고, 브라우저에서 스토어가 복원된 뒤 실제 값을 그린다.
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { useRecentlyViewed } from "@/stores/recently-viewed-store";

export default function RecentlyViewed({ currentId, currentTitle }: { currentId: number; currentTitle: string }) {
  const { hydrated, entries, record } = useRecentlyViewed(
    useShallow((s) => ({ hydrated: s.hydrated, entries: s.entries, record: s.record })),
  );

  // 복원이 끝난 뒤에 현재 글을 기록한다 (복원 전에 기록하면 rehydrate 가 덮어쓴다)
  useEffect(() => {
    if (hydrated) record({ id: currentId, title: currentTitle });
  }, [hydrated, currentId, currentTitle, record]);

  const others = entries.filter((e) => e.id !== currentId);
  if (!hydrated || others.length === 0) return null;

  return (
    <aside className="rounded-lg bg-muted/50 p-3 text-sm">
      <div className="mb-1 text-xs font-medium text-muted-foreground">최근 본 글 (zustand persist · next/dynamic)</div>
      <ul className="space-y-1">
        {others.map((e) => (
          <li key={e.id}>
            <Link href={`/posts/${e.id}`} className="hover:underline">{e.title}</Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
