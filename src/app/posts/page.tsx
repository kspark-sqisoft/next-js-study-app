// /posts 글 목록 (서버 컴포넌트).
// getPosts() 가 "use cache" 라서 이 페이지의 목록 부분은 빌드 시 정적 셸에 포함되고,
// 이후에는 cacheLife 시간이 지나거나 updateTag 가 호출될 때만 다시 만들어진다 (ISR).
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getPosts } from "@/lib/posts";
import { CacheControls } from "./cache-controls";
import { NewPostForm } from "./new-post-form";

export const metadata: Metadata = { title: "글 목록 | Next.js Study App" };

export default async function PostsPage() {
  const { posts, cachedAt } = await getPosts(); // 캐시 히트면 DB 를 읽지 않는다

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">글 목록</h1>
          <Badge variant="secondary">{posts.length}개</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          목록 캐시 생성 시각: <time dateTime={cachedAt}>{cachedAt}</time>
          <br />
          새로고침해도 이 시각은 바뀌지 않는다. 1분 뒤 첫 요청에서 백그라운드 재생성되거나, 아래
          버튼 / 글 작성으로 즉시 갱신된다.
        </p>
        <CacheControls />
      </section>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          아직 글이 없습니다. <code>npm run db:seed</code> 로 샘플을 넣거나 아래에서 작성하세요.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {posts.map((post) => (
            <li key={post.id}>
              {/* Link 는 화면에 보이면 대상 라우트의 정적 셸을 미리 가져온다 (prefetch) */}
              <Link
                href={`/posts/${post.id}`}
                className="block px-4 py-3 hover:bg-muted"
              >
                <div className="font-medium">{post.title}</div>
                <div className="text-xs text-muted-foreground">
                  #{post.id} · {post.createdAt}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2 className="mb-3 font-semibold">새 글 작성</h2>
        <NewPostForm />
      </section>
    </div>
  );
}
