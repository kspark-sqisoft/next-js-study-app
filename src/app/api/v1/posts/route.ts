// GET  /api/v1/posts — 글 목록 (누구나, 인증 불필요)
// POST /api/v1/posts — 글 작성 (인증 필요)
//
// 읽기는 열고 쓰기는 잠근다. 웹사이트에서 글이 이미 공개인데 API 만 막으면 의미가 없고,
// 반대로 아무나 쓸 수 있으면 스팸을 막을 방법이 없다.
//
// 참고: 기존 /api/posts 는 이 앱의 데모 화면(SWR, 무한 스크롤)이 쓰는 내부용이라 그대로 두었다.
// 공개 계약은 /api/v1 아래에만 둔다. 버전이 경로에 있으면 나중에 응답 모양을 바꿔야 할 때
// /api/v2 를 새로 열어 두 버전을 동시에 운영할 수 있다.
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/api/auth";
import { ok, okList, paginationOf, parseJsonBody, parseQuery } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { serializePost } from "@/lib/api/serialize";
import { createPost, listPosts } from "@/lib/posts";
import { postCreateSchema, postListQuerySchema } from "@/lib/schemas/api";

export const GET = apiRoute(async ({ request }) => {
  const { q, limit, offset } = parseQuery(request.nextUrl, postListQuerySchema);
  const { posts, total } = listPosts(q ?? "", limit, offset);

  return okList(
    posts.map((post) => serializePost(post, request.nextUrl.origin)),
    paginationOf(total, limit, offset, posts.length),
  );
});

export const POST = apiRoute(async ({ request, auth }) => {
  const { user } = requireAuth(auth);
  const { title, content } = await parseJsonBody(request, postCreateSchema);

  // 이미지 첨부는 v1 에 없다. JSON 본문에 파일을 넣으려면 base64 로 부풀려야 하고,
  // 실무에서는 보통 "업로드용 URL 을 받아 브라우저가 직접 올리는" 별도 흐름으로 푼다.
  const post = createPost(title, content, user.id, null);

  // 화면 쪽 "use cache" 결과를 무효화한다.
  // Server Action 에서 쓰던 updateTag() 는 Route Handler 에서 호출할 수 없다(Next.js 16 제약).
  // 대신 revalidateTag(tag, { expire: 0 }) 를 쓴다 — 낡은 내용을 내주지 않고 다음 요청이 바로 새로 만든다.
  revalidateTag("posts", { expire: 0 });

  return ok(serializePost(post, request.nextUrl.origin), 201, {
    // 201 응답에는 만들어진 리소스의 위치를 알려 주는 것이 관례다
    Location: `${request.nextUrl.origin}/api/v1/posts/${post.id}`,
  });
});
