// /todos 세그먼트의 로딩 UI. page.tsx 를 자동으로 <Suspense> 로 감싼다.
// Cache Components 에서는 캐시되지 않은 데이터(getTodos 의 connection())를 읽는 페이지에
// 반드시 Suspense 경계가 필요하다. loading.tsx 가 그 경계 역할을 한다.
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex flex-1 items-start justify-center p-8">
      <div className="w-full max-w-lg space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </main>
  );
}
