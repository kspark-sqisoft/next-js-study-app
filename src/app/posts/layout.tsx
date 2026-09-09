// /posts 아래 모든 페이지가 공유하는 중첩 레이아웃.
// 페이지를 이동해도 이 부분은 다시 렌더링되지 않고 유지된다.
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export default function PostsLayout({ children }: LayoutProps<"/posts">) {
  return (
    <div className="mx-auto w-full max-w-2xl p-8">
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/" className="text-muted-foreground hover:underline">
          홈
        </Link>
        <Link href="/posts" className="font-medium hover:underline">
          글 목록
        </Link>
        <Link href="/posts/client" className="font-medium hover:underline">
          클라이언트 검색
        </Link>
      </nav>
      <Separator className="my-4" />
      {children}
    </div>
  );
}
