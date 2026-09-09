// SWR 로 검색 결과를 가져오는 클라이언트 컴포넌트.
"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Input } from "@/components/ui/input";

type SearchResponse = {
  query: string;
  total: number;
  posts: { id: number; title: string; createdAt: string }[];
};

// SWR 에 넘길 fetcher. URL 을 받아 JSON 을 돌려준다.
async function fetcher(url: string): Promise<SearchResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`요청 실패: ${res.status}`);
  return res.json();
}

export function PostSearch() {
  const [query, setQuery] = useState("");

  // 첫 번째 인자가 캐시 키이자 요청 URL. 같은 키로 여러 컴포넌트가 요청해도 한 번만 호출된다.
  // isLoading: 데이터가 아직 없을 때 / isValidating: 백그라운드 재검증 중일 때도 true
  const { data, error, isLoading, isValidating } = useSWR(
    `/api/posts?q=${encodeURIComponent(query)}`,
    fetcher,
    { keepPreviousData: true }, // 키가 바뀌는 동안 이전 결과를 유지해 깜빡임을 줄인다
  );

  return (
    <div className="space-y-3">
      <Input
        placeholder="제목이나 내용으로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}

      {data && (
        <div className={isValidating ? "opacity-60" : ""}>
          <p className="text-xs text-muted-foreground">
            &quot;{data.query}&quot; 결과 {data.posts.length}건 / 전체 {data.total}건
            {isValidating && " (갱신 중)"}
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
