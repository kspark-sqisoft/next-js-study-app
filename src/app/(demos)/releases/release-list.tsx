// use() 로 서버가 넘긴 Promise 를 읽는 클라이언트 컴포넌트.
// Promise 가 아직 pending 이면 use() 가 suspend 하고, 부모의 <Suspense> fallback 이 보인다.
"use client";

import { use, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Release } from "@/lib/github";

type Props = { releasesPromise: Promise<{ releases: Release[]; fetchedAt: string }> };

export function ReleaseList({ releasesPromise }: Props) {
  const { releases, fetchedAt } = use(releasesPromise);
  const [showPrerelease, setShowPrerelease] = useState(false); // 클라이언트 상태: 서버 재요청 없이 필터

  const visible = releases.filter((r) => showPrerelease || !r.prerelease);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>캐시 생성: <time dateTime={fetchedAt}>{fetchedAt}</time></span>
        <Button size="xs" variant="ghost" onClick={() => setShowPrerelease((v) => !v)}>
          {showPrerelease ? "정식 릴리스만" : "프리릴리스 포함"}
        </Button>
      </div>
      <ul className="divide-y rounded-lg border">
        {visible.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">
              {r.name}
            </a>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {r.prerelease && <Badge variant="secondary">pre</Badge>}
              {new Date(r.publishedAt).toLocaleDateString("ko-KR")}
            </span>
          </li>
        ))}
        {visible.length === 0 && <li className="px-4 py-2 text-sm text-muted-foreground">표시할 릴리스가 없습니다.</li>}
      </ul>
    </div>
  );
}
