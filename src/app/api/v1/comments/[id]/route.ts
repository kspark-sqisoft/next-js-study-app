// DELETE /api/v1/comments/:id — 댓글 삭제 (작성자 본인만)
//
// 최상위 댓글을 지우면 그 아래 답글도 함께 사라진다 (스키마의 ON DELETE CASCADE).
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/api/auth";
import { forbidden, noContent, notFound, parseIdParam } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { commentsTag, deleteComment, findComment } from "@/lib/comments";

export const DELETE = apiRoute<{ id: string }>(async ({ params, auth }) => {
  const { user } = requireAuth(auth);
  const id = parseIdParam(params.id);

  const comment = await findComment(id);
  if (!comment) throw notFound("존재하지 않는 댓글입니다.");
  if (comment.authorId !== user.id) throw forbidden("본인이 쓴 댓글만 삭제할 수 있습니다.");

  await deleteComment(id);
  revalidateTag(commentsTag(comment.postId), { expire: 0 });

  return noContent();
});
