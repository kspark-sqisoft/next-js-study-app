// GET /api/posts?q=검색어            → 검색 결과 전체 (클라이언트 페칭 데모: SWR / TanStack Query / fetch)
// GET /api/posts?cursor=<id>&limit=5 → 커서 기반 페이지 (무한 스크롤 데모). nextCursor 가 null 이면 끝
// request 의 쿼리스트링을 읽으므로 항상 요청 시점에 실행된다 (캐시되지 않음).
import { type NextRequest } from "next/server";
import { countPosts, getPostsByCursor, searchPosts, type Post } from "@/lib/posts";

const MAX_LIMIT = 20;

function toItem({ id, title, authorName, imagePath, createdAt }: Post) {
  return { id, title, authorName, imagePath, createdAt }; // 필요한 필드만 (본문 전체는 내려보내지 않는다)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const limitParam = sp.get("limit");

  await sleep(500); // 네트워크 지연을 흉내 내어 로딩 상태를 눈으로 볼 수 있게 한다 (학습용)

  if (limitParam !== null) {
    // 커서 모드
    const limit = Math.min(Math.max(1, Number(limitParam) || 5), MAX_LIMIT);
    const cursorParam = sp.get("cursor");
    const cursor = cursorParam ? Number(cursorParam) : null;
    if (cursor !== null && !Number.isInteger(cursor)) {
      return Response.json({ error: "cursor 는 정수여야 합니다." }, { status: 400 });
    }
    const { posts, nextCursor } = await getPostsByCursor(q, cursor, limit);
    return Response.json({ query: q, posts: posts.map(toItem), nextCursor });
  }

  // 검색 모드 (기존 동작)
  const [total, found] = await Promise.all([countPosts(), searchPosts(q)]);
  return Response.json({
    query: q,
    total,
    posts: found.map(({ id, title, createdAt }) => ({ id, title, createdAt })),
  });
}
