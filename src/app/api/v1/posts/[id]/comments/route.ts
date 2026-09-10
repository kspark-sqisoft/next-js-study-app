// GET  /api/v1/posts/:id/comments — 댓글 목록 (누구나)
// POST /api/v1/posts/:id/comments — 댓글/답글 작성 (인증 필요)
//
// 댓글은 글에 속하므로 URL 도 글 아래에 둔다 (/posts/3/comments).
// 반면 "댓글 하나 삭제" 는 글 없이도 id 만으로 특정되므로 /api/v1/comments/:id 에 따로 있다.
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/api/auth";
import { badRequest, notFound, ok, okList, paginationOf, parseIdParam, parseJsonBody, parseQuery } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { serializeComment } from "@/lib/api/serialize";
import { commentsTag, createComment, findComment, listComments } from "@/lib/comments";
import { findPost } from "@/lib/posts";
import { commentCreateSchema, listQuerySchema } from "@/lib/schemas/api";

async function requirePost(rawId: string) {
  const id = parseIdParam(rawId);
  const post = await findPost(id);
  if (!post) throw notFound("존재하지 않는 글입니다.");
  return post;
}

export const GET = apiRoute<{ id: string }>(async ({ request, params }) => {
  const post = await requirePost(params.id);
  const { limit, offset } = parseQuery(request.nextUrl, listQuerySchema);
  const { comments, total } = await listComments(post.id, limit, offset);

  // 평탄한 배열 + parentId 로 준다. 트리 조립은 클라이언트 몫이다 (listComments 주석 참고).
  return okList(comments.map(serializeComment), paginationOf(total, limit, offset, comments.length));
});

export const POST = apiRoute<{ id: string }>(async ({ request, params, auth }) => {
  const { user } = requireAuth(auth);
  const post = await requirePost(params.id);
  const { content, parentId } = await parseJsonBody(request, commentCreateSchema);

  if (parentId != null) {
    const parent = await findComment(parentId);
    // 부모가 (1) 존재하고 (2) 같은 글의 댓글이고 (3) 그 자신이 최상위여야 한다.
    // (3) 이 답글의 답글, 즉 3단 이상을 막는다. 화면 규칙과 같다.
    if (!parent || parent.postId !== post.id || parent.parentId !== null) {
      throw badRequest("답글을 달 수 없는 댓글입니다. parentId 는 같은 글의 최상위 댓글이어야 합니다.");
    }
  }

  const id = await createComment(post.id, user.id, content, parentId ?? null);
  revalidateTag(commentsTag(post.id), { expire: 0 });

  return ok(serializeComment((await findComment(id))!), 201);
});
