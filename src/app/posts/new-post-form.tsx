// 글 작성 폼. 공용 PostForm 에 작성 액션을 연결한다.
"use client";

import { createPostAction } from "./actions";
import { PostForm } from "./post-form";

export function NewPostForm() {
  return <PostForm action={createPostAction} submitLabel="작성" />;
}
