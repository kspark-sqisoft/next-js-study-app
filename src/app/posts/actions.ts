// posts 관련 Server Actions.
//
// 권한 규칙:
// - 글 작성/댓글 작성: 로그인 필요
// - 글 수정/삭제, 댓글 삭제: 작성자 본인만
// 화면에서 버튼을 숨기는 것과 별개로, 모든 액션이 세션을 다시 읽어 직접 검사한다.
// Server Action 은 브라우저에서 직접 POST 로 호출할 수 있으므로 공개 API 와 같은 수준으로 방어해야 한다.
//
// 데이터를 바꾼 뒤에는 캐시 태그를 무효화해서 "use cache" 된 조회 결과가 새로 만들어지게 한다.
"use server";

import { revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/dal";
import { commentsTag, createComment, deleteComment, findComment } from "@/lib/comments";
import { createPost, deletePost, getPost, updatePost } from "@/lib/posts";
import { commentSchema } from "@/lib/schemas/comment";
import { postSchema, type PostFieldErrors } from "@/lib/schemas/post";

export type PostFormState = {
  errors?: PostFieldErrors & { form?: string[] };
  fields?: { title: string; content: string };
} | null;

function parsePostForm(formData: FormData) {
  const raw = {
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
  };
  const result = postSchema.safeParse(raw);
  return { raw, result };
}

// 글 작성. 로그인 필요. 성공하면 목록 캐시를 즉시 만료시키고 상세 페이지로 이동한다.
export async function createPostAction(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { raw, result } = parsePostForm(formData);
  if (!result.success) {
    return { errors: z.flattenError(result.error).fieldErrors, fields: raw };
  }

  const post = createPost(result.data.title, result.data.content, user.id);

  // updateTag: 다음 요청이 "새 데이터를 기다렸다가" 응답한다 (read-your-own-writes).
  updateTag("posts");
  redirect(`/posts/${post.id}`); // redirect 는 예외를 던지므로 이 아래는 실행되지 않는다
}

// 글 수정. 작성자 본인만. id 는 bind 로 미리 묶어서 폼에 연결한다.
export async function updatePostAction(id: number, _prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const post = await getPost(id);
  if (!post) return { errors: { form: ["존재하지 않는 글입니다."] } };
  if (post.authorId !== user.id) return { errors: { form: ["본인이 작성한 글만 수정할 수 있습니다."] } };

  const { raw, result } = parsePostForm(formData);
  if (!result.success) {
    return { errors: z.flattenError(result.error).fieldErrors, fields: raw };
  }

  updatePost(id, result.data.title, result.data.content);
  updateTag("posts");
  updateTag(`post-${id}`);
  redirect(`/posts/${id}`);
}

// 글 삭제. 작성자 본인만. 목록 캐시와 해당 글 캐시를 모두 무효화한 뒤 목록으로 이동.
export async function deletePostAction(id: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const post = await getPost(id);
  if (!post) return { error: "이미 삭제된 글입니다." };
  if (post.authorId !== user.id) return { error: "본인이 작성한 글만 삭제할 수 있습니다." };

  deletePost(id); // comments 는 ON DELETE CASCADE 로 함께 삭제
  updateTag("posts");
  updateTag(`post-${id}`);
  redirect("/posts");
}

// ---------------------------------------------------------------------------
// 댓글
// ---------------------------------------------------------------------------

export type CommentFormState = { error?: string; ok?: boolean } | null;

// 댓글/답글 작성. parentId 가 있으면 답글. 2단까지만 허용한다.
export async function addCommentAction(
  postId: number,
  parentId: number | null,
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "댓글을 쓰려면 로그인하세요." };

  const result = commentSchema.safeParse({ content: String(formData.get("content") ?? "") });
  if (!result.success) return { error: z.flattenError(result.error).fieldErrors.content?.[0] };

  const post = await getPost(postId);
  if (!post) return { error: "존재하지 않는 글입니다." };

  if (parentId !== null) {
    const parent = findComment(parentId);
    // 부모가 같은 글의 "최상위" 댓글이어야 한다 → 답글의 답글(3단)은 막는다
    if (!parent || parent.postId !== postId || parent.parentId !== null) {
      return { error: "답글을 달 수 없는 댓글입니다." };
    }
  }

  createComment(postId, user.id, result.data.content, parentId);
  updateTag(commentsTag(postId));
  return { ok: true };
}

// 댓글 삭제. 작성자 본인만. 최상위 댓글을 지우면 답글도 함께 지워진다(CASCADE).
export async function deleteCommentAction(commentId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const comment = findComment(commentId);
  if (!comment) return { error: "이미 삭제된 댓글입니다." };
  if (comment.authorId !== user.id) return { error: "본인이 쓴 댓글만 삭제할 수 있습니다." };

  deleteComment(commentId);
  updateTag(commentsTag(comment.postId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 캐시 갱신 방식 비교용 액션 두 개. 데이터는 바꾸지 않고 캐시만 건드린다.
// ---------------------------------------------------------------------------

// 1) updateTag: 즉시 만료. 다음 요청은 캐시를 새로 만들 때까지 기다린다.
export async function refreshPostsNowAction() {
  updateTag("posts");
}

// 2) revalidateTag(tag, "max"): stale-while-revalidate.
//    다음 요청은 기존 캐시를 그대로 주고, 백그라운드에서 새로 만든다. 그 다음 요청부터 새 값이 보인다.
export async function refreshPostsInBackgroundAction() {
  revalidateTag("posts", "max");
}
