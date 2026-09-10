// (demos) 라우트 그룹: 괄호 폴더는 URL 에 안 들어간다 → /feed, /client-fetch, /releases
// /posts 와 같은 네비게이션을 공유한다. TanStack Query Provider 는 tRPC 와 함께 루트 레이아웃(TRPCReactProvider)에 있다.
import { PostsNav } from "@/components/posts-nav";

export default function DemosLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-2xl p-8">
      <PostsNav />
      {children}
    </div>
  );
}
