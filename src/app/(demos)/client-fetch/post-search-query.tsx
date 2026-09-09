// TanStack Query(useQuery) 로 검색 결과를 가져오는 클라이언트 컴포넌트.
// post-search.tsx(SWR) 와 같은 기능을 같은 API 로 구현해 두 라이브러리를 비교한다.
"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";

type SearchResponse = {
  query: string;
  total: number;
  posts: { id: number; title: string; createdAt: string }[];
};

async function searchPosts(query: string): Promise<SearchResponse> {
  const res = await fetch(`/api/posts?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`요청 실패: ${res.status}`);
  return res.json();
}

export function PostSearchQuery() {
  const [query, setQuery] = useState("");

  // queryKey: 캐시 키. 배열 형태라 ["posts", "search", query] 처럼 구조화할 수 있다 (SWR 은 문자열 URL).
  // queryFn:  실제 데이터를 가져오는 함수. SWR 의 fetcher 에 해당.
  // isPending: 캐시에 데이터가 아직 없을 때 / isFetching: 백그라운드 재요청 중일 때도 true
  const { data, error, isPending, isFetching } = useQuery({
    queryKey: ["posts", "search", query],
    queryFn: () => searchPosts(query),
    placeholderData: keepPreviousData, // 키가 바뀌는 동안 이전 결과를 유지 (SWR 의 keepPreviousData)
  });

  return (
    <div className="space-y-3">
      <Input
        placeholder="제목이나 내용으로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {isPending && <p className="text-sm text-muted-foreground">불러오는 중...</p>}

      {data && (
        <div className={isFetching ? "opacity-60" : ""}>
          <p className="text-xs text-muted-foreground">
            &quot;{data.query}&quot; 결과 {data.posts.length}건 / 전체 {data.total}건
            {isFetching && " (갱신 중)"}
          </p>
          <ul className="mt-2 divide-y rounded-lg border text-sm">
            {data.posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/posts/${post.id}`}
                  className="block px-3 py-2 hover:bg-muted"
                >
                  {post.title}
                </Link>
              </li>
            ))}
            {data.posts.length === 0 && (
              <li className="px-3 py-2 text-muted-foreground">결과 없음</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
