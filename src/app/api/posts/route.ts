// GET /api/posts?q=검색어
// 클라이언트 사이드 페칭(/posts/client) 데모에서 SWR 과 fetch 가 호출하는 REST API.
// request 의 쿼리스트링을 읽으므로 항상 요청 시점에 실행된다 (캐시되지 않음).
import { type NextRequest } from "next/server";
import { countPosts, searchPosts } from "@/lib/posts";

export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  // 네트워크 지연을 흉내 내어 로딩 상태를 눈으로 볼 수 있게 한다 (학습용)
  return new Promise<Response>((resolve) => {
    setTimeout(() => {
      resolve(
        Response.json({
          query: q,
          total: countPosts(),
          posts: searchPosts(q).map(({ id, title, createdAt }) => ({
            id,
            title,
            createdAt,
          })),
        }),
      );
    }, 500);
  });
}
