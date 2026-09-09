// GET    /api/v1/posts/:id — 글 한 건 (누구나)
// PATCH  /api/v1/posts/:id — 수정 (작성자 본인만)
// DELETE /api/v1/posts/:id — 삭제 (작성자 본인만)
//
// 권한 검사는 화면의 Server Action(src/app/posts/actions.ts)과 똑같은 규칙이다.
// 규칙을 "화면에서 버튼을 숨기는 것" 에 맡기면 API 로 우회할 수 있으므로,
// 데이터를 바꾸는 모든 입구에서 각자 다시 검사한다.
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/api/auth";
import { forbidden, noContent, notFound, ok, parseIdParam, parseJsonBody } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { serializePost } from "@/lib/api/serialize";
import { deletePost, findPost, updatePost } from "@/lib/posts";
import { postUpdateSchema } from "@/lib/schemas/api";
import { deleteImage } from "@/lib/uploads";

/** 세 핸들러가 모두 하는 일: id 파싱 → 글 조회 → 없으면 404 */
function loadPost(rawId: string) {
  const id = parseIdParam(rawId);
  const post = findPost(id);
  if (!post) throw notFound("존재하지 않는 글입니다.");
  return post;
}

export const GET = apiRoute<{ id: string }>(async ({ request, params }) => {
  return ok(serializePost(loadPost(params.id), request.nextUrl.origin));
});

export const PATCH = apiRoute<{ id: string }>(async ({ request, params, auth }) => {
  const { user } = requireAuth(auth);
  const post = loadPost(params.id);
  if (post.authorId !== user.id) throw forbidden("본인이 작성한 글만 수정할 수 있습니다.");

  const body = await parseJsonBody(request, postUpdateSchema);

  // PATCH 는 부분 변경이다. 온 필드만 바꾸고 나머지는 기존 값을 그대로 둔다.
  // imagePath 를 그대로 넘기는 것이 중요하다 — 빠뜨리면 수정할 때마다 첨부 이미지가 사라진다.
  updatePost(post.id, body.title ?? post.title, body.content ?? post.content, post.imagePath);

  revalidateTag("posts", { expire: 0 });
  revalidateTag(`post-${post.id}`, { expire: 0 });

  return ok(serializePost(findPost(post.id)!, request.nextUrl.origin));
});

export const DELETE = apiRoute<{ id: string }>(async ({ params, auth }) => {
  const { user } = requireAuth(auth);
  const post = loadPost(params.id);
  if (post.authorId !== user.id) throw forbidden("본인이 작성한 글만 삭제할 수 있습니다.");

  deletePost(post.id); // 댓글은 ON DELETE CASCADE 로 함께 삭제된다
  await deleteImage(post.imagePath); // 첨부 파일도 정리 (DB 행만 지우면 파일이 계속 남는다)

  revalidateTag("posts", { expire: 0 });
  revalidateTag(`post-${post.id}`, { expire: 0 });

  return noContent();
});
