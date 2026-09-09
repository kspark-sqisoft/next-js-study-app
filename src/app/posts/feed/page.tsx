// /posts/feed 무한 스크롤 (스크롤 끝에 닿으면 다음 글을 불러온다).
//
// 구성:
// - 첫 페이지는 서버 컴포넌트가 캐시된 getPostsPage("", 1) 로 렌더링한다.
//   PostFeed 는 프리렌더 중 suspend 하므로(use(io())), 같은 목록을 정적 fallback 으로도 그려 셸에 넣는다.
// - 이후 페이지는 브라우저가 /api/posts?cursor=&limit= 를 호출한다 (TanStack Query useInfiniteQuery).
// - /posts 의 "번호 페이지네이션(offset)" 과 비교해 보자. 둘 다 같은 데이터, 다른 UX 다.
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getPostsPage, PAGE_SIZE } from "@/lib/posts";
import { PostFeed, type FeedItem } from "./post-feed";

export const metadata: Metadata = { title: "무한 스크롤 | Next.js Study App" };

export default async function FeedPage() {
  const first = await getPostsPage("", 1); // "use cache" 된 첫 페이지 (posts 태그로 무효화됨)
  const initialPosts = first.posts.map(({ id, title, authorName, imagePath, createdAt }) => ({
    id, title, authorName, imagePath, createdAt,
  }));
  // 첫 페이지가 꽉 찼으면 더 있을 수 있다 → 마지막 id 를 커서로. 아니면 끝.
  const initialCursor = first.posts.length === PAGE_SIZE ? first.posts[first.posts.length - 1].id : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">무한 스크롤</h1>
      <p className="text-xs text-muted-foreground">
        첫 {PAGE_SIZE}개는 서버가 렌더링했고(캐시), 아래로 내리면 브라우저가 <code>/api/posts?cursor=…</code> 를
        호출해 이어 붙인다. 커서(마지막 id) 방식이라 중간에 글이 추가돼도 중복이 생기지 않는다.
      </p>
      {/* 정적 셸: fallback 의 첫 페이지 목록. 요청 시/브라우저에서는 상호작용하는 PostFeed 로 교체된다 */}
      <Suspense fallback={<StaticList posts={initialPosts} />}>
        <PostFeed initialPosts={initialPosts} initialCursor={initialCursor} pageSize={PAGE_SIZE} />
      </Suspense>
    </div>
  );
}

// PostFeed 와 같은 모양의 정적 목록 (프리렌더용 fallback). 스크롤 감지는 없다.
function StaticList({ posts }: { posts: FeedItem[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/posts/${post.id}`} className="block px-4 py-3 hover:bg-muted">
            <div className="truncate font-medium">{post.title}</div>
            <div className="text-xs text-muted-foreground">
              #{post.id} · {post.authorName ?? "작성자 없음"} · {post.createdAt}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
