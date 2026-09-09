// posts 관련 Server Actions.
// 데이터를 바꾼 뒤에는 캐시 태그를 무효화해서 "use cache" 된 조회 결과가 새로 만들어지게 한다.
"use server";

import { revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createPost, deletePost } from "@/lib/posts";

export type PostFormState = {
  error?: string;
  fields?: { title: string; content: string };
} | null;

// 글 작성. 성공하면 updateTag 로 목록 캐시를 즉시 만료시키고 상세 페이지로 이동한다.
export async function createPostAction(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!title || title.length > 100) {
    return { error: "제목은 1~100자로 입력하세요.", fields: { title, content } };
  }
  if (!content || content.length > 5000) {
    return { error: "내용은 1~5000자로 입력하세요.", fields: { title, content } };
  }

  const post = createPost(title, content);

  // updateTag: 다음 요청이 "새 데이터를 기다렸다가" 응답한다 (read-your-own-writes).
  // 내가 방금 쓴 글이 목록에 바로 보여야 하므로 revalidateTag 대신 이걸 쓴다.
  updateTag("posts");

  // redirect 는 예외를 던지는 방식이라 이 아래 코드는 실행되지 않는다.
  redirect(`/posts/${post.id}`);
}

// 글 삭제. 목록 캐시와 해당 글 캐시를 모두 무효화한 뒤 목록으로 이동.
export async function deletePostAction(id: number) {
  const deleted = deletePost(id);
  if (!deleted) return { error: "이미 삭제된 글입니다." };

  updateTag("posts");
  updateTag(`post-${id}`);
  redirect("/posts");
}

// 캐시 갱신 방식 비교용 액션 두 개. 데이터는 바꾸지 않고 캐시만 건드린다.

// 1) updateTag: 즉시 만료. 다음 요청은 캐시를 새로 만들 때까지 기다린다.
export async function refreshPostsNowAction() {
  updateTag("posts");
}

// 2) revalidateTag(tag, "max"): stale-while-revalidate.
//    다음 요청은 기존 캐시를 그대로 주고, 백그라운드에서 새로 만든다. 그 다음 요청부터 새 값이 보인다.
export async function refreshPostsInBackgroundAction() {
  revalidateTag("posts", "max");
}
