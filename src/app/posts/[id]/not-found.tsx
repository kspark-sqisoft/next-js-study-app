// /posts/[id] 에서 notFound() 가 호출되면 페이지 대신 이 UI 가 렌더링된다.
// 예: /posts/9999 (없는 id), /posts/abc (숫자가 아님)
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PostNotFound() {
  return (
    <div className="rounded-lg border p-6 text-center">
      <h2 className="text-lg font-semibold">글을 찾을 수 없습니다</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        삭제되었거나 존재하지 않는 글입니다. (not-found.tsx)
      </p>
      <Button className="mt-4" variant="outline" nativeButton={false} render={<Link href="/posts" />}>
        목록으로
      </Button>
    </div>
  );
}
