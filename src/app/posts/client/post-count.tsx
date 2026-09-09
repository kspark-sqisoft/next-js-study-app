// 라이브러리 없이 useEffect + fetch 로 데이터를 가져오는 클라이언트 컴포넌트.
// SWR 이 대신 해 주던 것들(로딩 상태, 에러 상태, 언마운트 시 요청 취소)을 직접 처리한다.
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; total: number; fetchedAt: string };

export function PostCount() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0); // 값이 바뀌면 effect 가 다시 실행된다

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/posts", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`요청 실패: ${res.status}`);
        return res.json() as Promise<{ total: number }>;
      })
      .then((json) =>
        setState({
          status: "success",
          total: json.total,
          fetchedAt: new Date().toLocaleTimeString(),
        }),
      )
      .catch((err: Error) => {
        if (err.name === "AbortError") return; // 언마운트로 취소된 경우는 무시
        setState({ status: "error", message: err.message });
      });

    // cleanup: 컴포넌트가 사라지거나 reloadKey 가 바뀌면 진행 중인 요청을 취소
    return () => controller.abort();
  }, [reloadKey]);

  return (
    <div className="flex items-center gap-3 text-sm">
      {state.status === "loading" && <span className="text-muted-foreground">불러오는 중...</span>}
      {state.status === "error" && <span className="text-destructive">{state.message}</span>}
      {state.status === "success" && (
        <span>
          전체 글 <strong>{state.total}</strong>개 (조회 {state.fetchedAt})
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          // 로딩 표시는 이벤트 핸들러에서 바꾸고, effect 는 요청만 담당한다
          setState({ status: "loading" });
          setReloadKey((k) => k + 1);
        }}
      >
        다시 조회
      </Button>
    </div>
  );
}
