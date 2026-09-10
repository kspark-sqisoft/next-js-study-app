// 글 목록 검색창 (클라이언트 컴포넌트). 디바운스로 "입력이 멈추면" 서버에 검색을 요청한다.
//
// 동작:
// - 타이핑 → 400ms 동안 추가 입력이 없으면 router.replace("/posts?q=…") 로 URL 을 바꾼다.
//   URL 이 바뀌면 서버 컴포넌트(PostList)가 새 searchParams 로 다시 렌더링된다. 검색 자체는 여전히 서버가 한다.
// - Enter 나 검색 버튼 → 디바운스를 기다리지 않고 즉시 이동.
// - JS 가 없어도 <form method="get"> 이라 브라우저가 ?q= 로 이동시킨다 (점진적 향상).
// - router.replace: 키 입력마다 히스토리가 쌓이지 않게 push 대신 replace. 뒤로 가기 한 번에 목록 이전 페이지로 간다.
// - useTransition: 이동하는 동안 현재 목록을 그대로 두고 isPending 만 켠다 (Suspense fallback 으로 깜빡이지 않음).
// - 입력창은 비제어(uncontrolled, defaultValue)로 둔다. 제어 컴포넌트(value={state})로 만들면 hydration 이 끝나는 순간
//   React 가 DOM 값을 초기 state 로 되돌려서, 사용자가 hydration 전에 타이핑한 글자가 사라진다.
"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

const DEBOUNCE_MS = 400;

export function PostSearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasValue, setHasValue] = useState(initialQuery.length > 0); // "지우기" 버튼 표시용
  const [isPending, startTransition] = useTransition();

  function navigate(query: string) {
    const q = query.trim();
    // 페이지 번호는 검색어가 바뀌면 1로 돌아가야 하므로 q 만 남긴다
    const href = q ? `/posts?${new URLSearchParams({ q })}` : "/posts";
    startTransition(() => router.replace(href, { scroll: false }));
  }

  const { debounced, cancel } = useDebouncedCallback(navigate, DEBOUNCE_MS);

  function handleChange(next: string) {
    setHasValue(next.length > 0);
    debounced(next); // 입력이 멈추면 실행
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault(); // JS 가 있으면 폼 제출 대신 즉시 이동
    cancel();
    navigate(inputRef.current?.value ?? "");
  }

  function handleClear() {
    cancel();
    if (inputRef.current) inputRef.current.value = "";
    setHasValue(false);
    navigate("");
    inputRef.current?.focus();
  }

  return (
    <form action="/posts" method="get" onSubmit={handleSubmit} className="flex gap-2" role="search">
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          name="q"
          defaultValue={initialQuery}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="제목이나 내용으로 검색 (입력이 멈추면 자동 검색)"
          aria-label="검색어"
          autoComplete="off"
        />
        {/* 이동 중 표시: 목록은 그대로 보이고 아이콘만 돈다 */}
        {isPending && (
          <Loader2Icon className="absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="검색 중" />
        )}
      </div>
      <Button type="submit" variant="outline">검색</Button>
      {hasValue && (
        <Button type="button" variant="ghost" onClick={handleClear} aria-label="검색어 지우기">
          <XIcon />
        </Button>
      )}
    </form>
  );
}
