// TanStack QueryClient 공장 함수.
// tRPC(@trpc/tanstack-react-query) 는 자체 캐시가 없고 TanStack Query 의 QueryClient 위에서 동작한다.
// 서버(server.tsx: 요청마다 새 클라이언트)와 브라우저(client.tsx: 하나만)가 같은 설정을 쓰도록 여기 모아 둔다.
// main 브랜치의 src/components/query-providers.tsx 에서 만들던 QueryClient 가 이 파일로 옮겨 온 셈이다.
import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // staleTime: 데이터를 "신선" 하다고 보는 시간. 이 안에서는 같은 쿼리를 다시 마운트해도 재요청하지 않는다.
        // 서버에서 prefetch 한 데이터를 브라우저가 받자마자 다시 요청하는 낭비를 막으려면 0 보다 커야 한다.
        staleTime: 30 * 1000,
      },
      // dehydrate: 서버의 QueryClient 상태를 직렬화해 HTML 에 실어 보내는 단계 (server.tsx 의 HydrateClient 가 호출).
      dehydrate: {
        // superjson: Date 같은 값이 직렬화 과정에서 문자열로 변하지 않게 한다. init.ts / client.tsx 의 transformer 와 짝.
        serializeData: superjson.serialize,
        // 기본은 "성공한 쿼리만" 넘긴다. pending 도 포함시키면 서버에서 아직 끝나지 않은 prefetch 결과를
        // Promise 상태 그대로 스트리밍할 수 있어, 서버 컴포넌트가 await 하지 않고도 클라이언트가 이어받는다.
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      // hydrate: 브라우저가 위 데이터를 받아 자기 QueryClient 에 넣는 단계. 직렬화의 반대.
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
