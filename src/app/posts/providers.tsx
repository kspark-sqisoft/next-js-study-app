// TanStack Query 의 Provider (클라이언트 컴포넌트). posts/layout.tsx 에서 /posts 전체에 적용한다.
// QueryClient 가 브라우저 캐시를 들고 있으므로, 이 Provider 아래의 컴포넌트들이 캐시를 공유한다.
"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function QueryProviders({ children }: { children: ReactNode }) {
  // useState 로 만들어 두면 리렌더링마다 새 클라이언트가 생기지 않는다.
  // (서버에서 SSR 될 때는 요청마다 새 인스턴스가 만들어져 요청 간에 데이터가 섞이지 않는다)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 1000, // 10초 동안은 "신선" 하다고 보고 재요청하지 않는다
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 화면 구석의 아이콘을 누르면 쿼리 캐시 상태를 볼 수 있다. 프로덕션 빌드에서는 자동 제외 */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
