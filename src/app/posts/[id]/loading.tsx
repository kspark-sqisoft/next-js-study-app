// /posts/[id] 세그먼트의 로딩 UI.
// 이 파일이 있으면 Next.js 가 page.tsx 를 자동으로 <Suspense fallback={<Loading />}> 로 감싼다.
// 목록에서 글을 클릭하면 서버 응답을 기다리는 동안 이 스켈레톤이 즉시 보인다.
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <p className="text-xs text-muted-foreground">loading.tsx 가 표시 중...</p>
    </div>
  );
}
