// 무한 스크롤 목록 (클라이언트 컴포넌트) — tRPC 버전.
//
// [main 브랜치와 비교] main 의 post-feed.tsx 는
//   - fetchFeedPage(cursor, limit) 함수가 fetch(`/api/posts?cursor=…&limit=…`) 를 호출하고
//   - `type FeedPage = { posts: FeedItem[]; nextCursor: number | null }` 를 손으로 선언하고
//   - useInfiniteQuery({ queryKey, queryFn, initialPageParam, getNextPageParam, ... }) 를 직접 조립했다.
// 이 브랜치는 trpc.posts.list.infiniteQueryOptions(...) 가 queryKey / queryFn / 커서 전달을 만들어 주고,
// FeedItem 타입은 라우터 반환 타입에서 뽑는다. IntersectionObserver 와 initialData 처리는 그대로다.
//
// [동작 요약]
// 1. 첫 페이지는 서버 컴포넌트(page.tsx)가 캐시된 getPostsPage("", 1) 로 렌더링해 initialData 로 넘긴다 → 빈 화면 없음.
// 2. 목록 끝의 sentinel div 가 화면에 들어오면 fetchNextPage() → tRPC 가 마지막 페이지의 nextCursor 를 cursor 입력에 넣어 요청.
// 3. nextCursor 가 null 이면 hasNextPage 가 false 가 되어 멈춘다.
"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { io } from "next/cache";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

// 목록 항목 타입은 라우터의 반환 타입에서 뽑는다 (손으로 적지 않는다).
// inferRouterOutputs<AppRouter> 는 "모든 프로시저의 반환 타입" 을 담은 객체 타입이고,
// ["posts"]["list"]["posts"][number] 로 그중 list 프로시저가 돌려주는 posts 배열의 원소 타입을 꺼낸다.
// 라우터에서 필드를 바꾸면 이 타입도 따라 바뀌어, 아래 JSX 에서 없는 필드를 쓰면 컴파일 에러가 난다.
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
export type FeedItem = inferRouterOutputs<AppRouter>["posts"]["list"]["posts"][number];

type Props = { initialPosts: FeedItem[]; initialCursor: number | null; pageSize: number };

export function PostFeed({ initialPosts, initialCursor, pageSize }: Props) {
  // Cache Components: TanStack Query 는 내부에서 Date.now() 를 쓰는데, 빌드 시 프리렌더 중에는 이런
  // "매번 달라지는 값" 이 정적 셸에 굳는 것을 막기 위해 에러를 낸다. use(io()) 는 프리렌더 중에는 suspend 하고
  // (부모 Suspense 의 fallback 이 셸에 들어간다), 실제 요청과 브라우저에서는 즉시 resolve 된다.
  use(io());

  const trpc = useTRPC();
  // infiniteQueryOptions(입력, 옵션):
  // - 입력 { limit } 에는 cursor 를 넣지 않는다. tRPC 가 각 페이지를 요청할 때 pageParam 을 cursor 필드에 자동으로 넣는다.
  //   (라우터의 입력 필드 이름이 반드시 "cursor" 여야 하는 이유. routers/posts.ts 참고)
  // - initialCursor: 첫 페이지의 pageParam. null = 처음부터.
  // - getNextPageParam: 마지막 페이지에서 다음 커서를 꺼낸다. null 을 돌려주면 hasNextPage 가 false.
  // - initialData: 서버가 미리 렌더링한 첫 페이지. pages 배열과 각 페이지에 쓴 pageParams 를 같은 길이로 준다.
  //   이것이 없으면 첫 렌더링이 isPending 상태라 목록이 비어 보인다.
  // - staleTime: 뒤로 갔다 와도 1분간은 다시 요청하지 않는다.
  // 반환값(data.pages 등)은 TanStack Query 의 useInfiniteQuery 그대로다.
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
    trpc.posts.list.infiniteQueryOptions(
      { limit: pageSize }, // cursor 는 tRPC 가 pageParam 으로 채워 넣는다
      {
        initialCursor: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor, // null 이면 hasNextPage 가 false
        // 서버가 렌더링한 첫 페이지. pageParams 는 각 페이지를 요청할 때 쓴 커서 (첫 페이지는 null)
        initialData: { pages: [{ posts: initialPosts, nextCursor: initialCursor }], pageParams: [null] },
        staleTime: 60 * 1000, // 뒤로 갔다 와도 1분간은 다시 요청하지 않는다
      },
    ),
  );

  // sentinel: 목록 맨 아래의 빈 div. 화면에 보이면 다음 페이지 요청.
  // IntersectionObserver 는 브라우저 API 라 useEffect 안에서만 만든다 (서버에는 없다).
  // 의존성에 hasNextPage 가 있어, 마지막 페이지에 닿으면 observer 를 만들지 않는다.
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

  // data.pages 는 페이지 배열([{posts, nextCursor}, ...]). 화면에는 하나의 목록으로 펴서 보여 준다
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
