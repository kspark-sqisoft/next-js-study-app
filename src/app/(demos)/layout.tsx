// (demos) 라우트 그룹: 괄호 폴더는 URL 에 안 들어간다 → /feed, /client-fetch, /releases
// /posts 와 같은 네비게이션을 공유하고, TanStack Query Provider 를 이 그룹에만 적용한다.
import { PostsNav } from "@/components/posts-nav";
import { QueryProviders } from "@/components/query-providers";

export default function DemosLayout({ children }: LayoutProps<"/"> ) {
  return (
    <QueryProviders>
      <div className="mx-auto w-full max-w-2xl p-8">
        <PostsNav />
        {children}
      </div>
    </QueryProviders>
  );
}
