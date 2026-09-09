// 무한 스크롤 목록 (클라이언트 컴포넌트).
// - useInfiniteQuery: 페이지들을 배열로 쌓아 두고, getNextPageParam 으로 다음 요청의 커서를 정한다.
// - IntersectionObserver: 목록 끝의 sentinel 요소가 화면에 들어오면 다음 페이지를 요청한다.
// - 서버가 준 첫 페이지를 initialData 로 넣어 "처음부터 빈 화면 → 로딩" 을 피한다.
"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { io } from "next/cache";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export type FeedItem = {
  id: number;
  title: string;
  authorName: string | null;
  imagePath: string | null;
  createdAt: string;
};

type FeedPage = { posts: FeedItem[]; nextCursor: number | null };

async function fetchFeedPage(cursor: number | null, limit: number): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor !== null) params.set("cursor", String(cursor));
  const res = await fetch(`/api/posts?${params}`);
  if (!res.ok) throw new Error(`요청 실패: ${res.status}`);
  return res.json();
}

type Props = { initialPosts: FeedItem[]; initialCursor: number | null; pageSize: number };

export function PostFeed({ initialPosts, initialCursor, pageSize }: Props) {
  // Cache Components: TanStack Query 는 내부에서 Date.now() 를 쓰는데, 빌드 시 프리렌더 중에는 이런
  // "매번 달라지는 값" 이 정적 셸에 굳는 것을 막기 위해 에러를 낸다. use(io()) 는 프리렌더 중에는 suspend 하고
  // (부모 Suspense 의 fallback 이 셸에 들어간다), 실제 요청과 브라우저에서는 즉시 resolve 된다.
  use(io());

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["posts", "feed"],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam, pageSize),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor, // null 이면 hasNextPage 가 false
    // 서버가 렌더링한 첫 페이지. pageParams 는 각 페이지를 요청할 때 쓴 커서 (첫 페이지는 null)
    initialData: { pages: [{ posts: initialPosts, nextCursor: initialCursor }], pageParams: [null] },
    staleTime: 60 * 1000, // 뒤로 갔다 와도 1분간은 다시 요청하지 않는다
  });

  // sentinel: 목록 맨 아래의 빈 div. 화면에 보이면 다음 페이지 요청
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" }, // 끝에 닿기 200px 전에 미리 요청해서 끊김을 줄인다
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data.pages.flatMap((p) => p.posts);

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/posts/${post.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
              {post.imagePath && (
                // eslint-disable-next-line @next/next/no-img-element -- 작은 썸네일
                <img src={`/api/uploads/${post.imagePath}`} alt="" className="size-10 rounded object-cover" />
              )}
              <div className="min-w-0">
                <div className="truncate font-medium">{post.title}</div>
                <div className="text-xs text-muted-foreground">
                  #{post.id} · {post.authorName ?? "작성자 없음"} · {post.createdAt}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* 관찰 대상. 화면에 들어오면 다음 페이지 */}
      <div ref={sentinelRef} aria-hidden className="h-1" />

      <div className="flex justify-center text-sm text-muted-foreground">
        {error && <span className="text-destructive">{error.message}</span>}
        {!error && isFetchingNextPage && <span>다음 글 불러오는 중...</span>}
        {!error && !isFetchingNextPage && hasNextPage && (
          // 스크롤이 안 생길 만큼 화면이 크거나, IntersectionObserver 가 없는 환경을 위한 수동 버튼
          <Button size="sm" variant="ghost" onClick={() => fetchNextPage()}>더 보기</Button>
        )}
        {!error && !hasNextPage && <span>더 이상 글이 없습니다. (전체 {posts.length}개)</span>}
      </div>
    </div>
  );
}
