// 내부 타입 → 외부에 내보낼 JSON 모양으로 바꾸는 함수 모음.
//
// DB 행을 그대로 내보내지 않고 한 겹을 두는 이유:
//  1. 컬럼을 추가해도 API 응답이 멋대로 바뀌지 않는다 (내부 구조와 공개 계약의 분리).
//  2. password_hash 같은 값이 실수로 새어 나갈 수 없다 — 여기에 안 적으면 안 나간다.
//  3. imagePath("uuid.jpg") 처럼 내부에서만 의미 있는 값을 바로 쓸 수 있는 URL 로 바꿔 준다.
import "server-only";
import type { ApiKey } from "@/lib/api-keys";
import type { Comment } from "@/lib/comments";
import type { Post } from "@/lib/posts";
import type { Todo } from "@/lib/todos";
import { imageUrl } from "@/lib/uploads";
import type { User } from "@/lib/users";

/** 글 작성자. 이메일은 포함하지 않는다 (공개 목록에서 남의 이메일이 보이면 안 된다). */
function author(id: number | null, name: string | null) {
  return id === null ? null : { id, name };
}

export function serializePost(post: Post, origin: string) {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    author: author(post.authorId, post.authorName),
    // 상대 경로 대신 절대 URL. 외부 클라이언트는 이 API 의 도메인을 모를 수도 있다.
    imageUrl: post.imagePath ? new URL(imageUrl(post.imagePath), origin).toString() : null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

export function serializeComment(comment: Comment) {
  return {
    id: comment.id,
    postId: comment.postId,
    // null 이면 최상위 댓글, 값이 있으면 그 댓글의 답글 (2단까지만)
    parentId: comment.parentId,
    author: { id: comment.authorId, name: comment.authorName },
    content: comment.content,
    createdAt: comment.createdAt,
  };
}

export function serializeTodo(todo: Todo) {
  return { id: todo.id, title: todo.title, completed: todo.completed, createdAt: todo.createdAt };
}

/** 본인 정보. 자기 이메일이므로 여기서는 포함한다. */
export function serializeUser(user: User) {
  return { id: user.id, name: user.name, email: user.email };
}

/** 발급된 키 정보. 키 원문(secret)은 발급 응답에서만 따로 붙인다. */
export function serializeApiKey(apiKey: ApiKey) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    lastUsedAt: apiKey.lastUsedAt,
    revokedAt: apiKey.revokedAt,
    createdAt: apiKey.createdAt,
  };
}
