// /posts/client 클라이언트 사이드 데이터 페칭 데모.
// 이 페이지(서버 컴포넌트)는 데이터를 전혀 읽지 않아 완전히 정적으로 미리 렌더링되고,
// 데이터는 브라우저에서 hydration 이후 /api/posts 를 호출해 가져온다.
import type { Metadata } from "next";
import { PostSearch } from "./post-search";
import { PostSearchQuery } from "./post-search-query";
import { PostCount } from "./post-count";

export const metadata: Metadata = { title: "클라이언트 검색 | Next.js Study App" };

export default function ClientFetchPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold">클라이언트 사이드 데이터 페칭</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          세 컴포넌트 모두 브라우저에서 <code>/api/posts</code> 를 호출한다. 개발자 도구 Network
          탭에서 요청을 확인해 보자. 서버는 응답을 0.5초 지연시킨다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">1. SWR (useSWR)</h2>
        <p className="text-xs text-muted-foreground">
          키(URL)가 바뀌면 자동 재요청, 같은 키는 중복 제거, 탭에 다시 돌아오면 자동 갱신.
        </p>
        <PostSearch />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">2. TanStack Query (useQuery)</h2>
        <p className="text-xs text-muted-foreground">
          SWR 과 같은 역할. 배열 형태의 쿼리 키, 더 많은 옵션, DevTools(화면 우하단 아이콘) 제공.
          같은 검색어를 위 SWR 과 여기서 각각 입력해 보면 서로 캐시가 다른 것을 알 수 있다.
        </p>
        <PostSearchQuery />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">3. useEffect + fetch</h2>
        <p className="text-xs text-muted-foreground">
          라이브러리 없이 직접 구현. 로딩/에러/취소 처리를 모두 손으로 해야 한다.
        </p>
        <PostCount />
      </section>
    </div>
  );
}
