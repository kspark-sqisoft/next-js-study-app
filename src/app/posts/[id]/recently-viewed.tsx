// 브라우저 전용 컴포넌트: localStorage 에 "최근 본 글" 을 기록하고 보여 준다.
// 렌더링 중에 localStorage 를 읽으므로 서버(SSR)에서는 실행할 수 없다 → next/dynamic 의 ssr:false 로만 로드한다.
// (useEffect 안에서만 읽도록 짜면 SSR 도 가능하지만, 여기서는 "왜 ssr:false 가 필요한가" 를 보여 주기 위해 일부러 이렇게 둔다)
"use client";

import Link from "next/link";
import { useState } from "react";

const KEY = "recently-viewed-posts";
const MAX = 5;

type Entry = { id: number; title: string };

function load(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Entry[];
  } catch {
    return [];
  }
}

export default function RecentlyViewed({ currentId, currentTitle }: { currentId: number; currentTitle: string }) {
  // 초기 상태를 계산하면서 현재 글을 맨 앞에 기록한다 (렌더링 시점에 localStorage 접근 → 브라우저 전용)
  const [others] = useState<Entry[]>(() => {
    const previous = load().filter((e) => e.id !== currentId);
    localStorage.setItem(KEY, JSON.stringify([{ id: currentId, title: currentTitle }, ...previous].slice(0, MAX)));
    return previous.slice(0, MAX - 1);
  });

  if (others.length === 0) return null;

  return (
    <aside className="rounded-lg bg-muted/50 p-3 text-sm">
      <div className="mb-1 text-xs font-medium text-muted-foreground">최근 본 글 (localStorage · next/dynamic)</div>
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
