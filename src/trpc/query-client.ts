// TanStack QueryClient 를 만드는 공장 함수. 서버(요청마다 새로)와 브라우저(하나만)가 같은 설정을 쓴다.
import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30초 동안은 "신선" 하다고 보고 재요청하지 않는다
      },
      // 서버에서 prefetch 한 결과를 브라우저로 넘길 때(dehydrate) pending 상태도 포함해 스트리밍되게 한다
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
