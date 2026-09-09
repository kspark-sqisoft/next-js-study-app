// /releases 외부 API 데이터를 서버에서 가져와 Promise 째로 클라이언트에 넘기는 예 (use() 패턴).
//
// 1. 서버 컴포넌트가 getNextReleases() 를 "await 하지 않고" 호출해 Promise 만 만든다.
// 2. Promise 를 <Suspense> 안의 클라이언트 컴포넌트에 props 로 넘긴다.
// 3. 클라이언트 컴포넌트가 use(promise) 로 값을 꺼낸다. 값이 올 때까지 fallback 이 보이고, 오면 스트리밍으로 교체된다.
// 이렇게 하면 데이터 가져오기는 서버에서, 필터/토글 같은 상호작용은 클라이언트에서 담당한다.
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getNextReleases } from "@/lib/github";
import { RefreshReleasesButton } from "./refresh-button";
import { ReleaseList } from "./release-list";

export const metadata: Metadata = { title: "Next.js 릴리스 | Next.js Study App" };

export default function ReleasesPage() {
  const releasesPromise = getNextReleases(); // await 하지 않는다

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Next.js 최신 릴리스</h1>
        <RefreshReleasesButton />
      </div>
      <p className="text-xs text-muted-foreground">
        GitHub API 를 서버에서 <code>fetch</code> 하고 <code>&quot;use cache&quot;</code> 로 1시간 캐시한다. 결과는 Promise
        상태로 클라이언트 컴포넌트에 넘겨 <code>use()</code> 로 읽는다. API 가 실패하면 error.tsx 가 잡는다.
      </p>
      <Suspense fallback={<ReleasesSkeleton />}>
        <ReleaseList releasesPromise={releasesPromise} />
      </Suspense>
    </div>
  );
}

function ReleasesSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-6 w-1/3" />
    </div>
  );
}
