// posts 관련 Server Actions.
// 데이터를 바꾼 뒤에는 캐시 태그를 무효화해서 "use cache" 된 조회 결과가 새로 만들어지게 한다.
//
// 폼 검증은 Zod 스키마(src/lib/schemas/post.ts)로 한다.
// 손으로 검증하는 todos/actions.ts 의 parseTitle 과 비교해 보자:
// - 규칙이 if 문이 아니라 스키마 객체 하나에 선언되어 있다
// - 에러가 문자열 하나가 아니라 필드별 배열로 나온다 → 입력창마다 메시지를 붙일 수 있다
// - 검증을 통과한 값은 이미 trim 되어 있고 타입도 보장된다
"use server";

import { revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createPost, deletePost } from "@/lib/posts";
import { postSchema, type PostFieldErrors } from "@/lib/schemas/post";

export type PostFormState = {
  errors?: PostFieldErrors; // 필드별 에러
  fields?: { title: string; content: string }; // 실패 시 입력값 복원용
} | null;

// 글 작성. 성공하면 updateTag 로 목록 캐시를 즉시 만료시키고 상세 페이지로 이동한다.
export async function createPostAction(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  // FormData 에서 꺼낸 값은 string | File | null 이라 일단 문자열로 만든다
  const raw = {
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
  };

  // safeParse: 예외를 던지지 않고 { success, data | error } 를 돌려준다
  const result = postSchema.safeParse(raw);
  if (!result.success) {
    return {
      errors: z.flattenError(result.error).fieldErrors, // { title?: string[], content?: string[] }
      fields: raw,
    };
  }

  // result.data 는 PostInput 타입이고 trim 이 적용된 값이다
  const post = createPost(result.data.title, result.data.content);

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
