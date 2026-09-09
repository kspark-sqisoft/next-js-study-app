// 글 작성 폼 (클라이언트 컴포넌트).
// useActionState 로 서버가 돌려준 필드별 에러(Zod)와 pending 상태를 다룬다.
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPostAction, type PostFormState } from "./actions";

export function NewPostForm() {
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(
    createPostAction,
    null,
  );

  // 필드별 첫 번째 에러 메시지
  const titleError = state?.errors?.title?.[0];
  const contentError = state?.errors?.content?.[0];

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {/* noValidate: 브라우저 기본 검증을 끄고 서버(Zod) 검증 결과만 보여 준다. 학습용.
          실제 서비스에서는 required 등 브라우저 검증도 같이 켜 두는 편이 사용자에게 친절하다. */}
      <div className="space-y-1">
        <Label htmlFor="title">제목</Label>
        {/* 검증 실패 시 서버가 돌려준 입력값을 defaultValue 로 복원한다 */}
        <Input
          id="title"
          name="title"
          defaultValue={state?.fields?.title}
          disabled={pending}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "title-error" : undefined}
        />
        {titleError && (
          <p id="title-error" className="text-sm text-destructive">
            {titleError}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="content">내용</Label>
        <Textarea
          id="content"
          name="content"
          rows={4}
          defaultValue={state?.fields?.content}
          disabled={pending}
          aria-invalid={contentError ? true : undefined}
          aria-describedby={contentError ? "content-error" : undefined}
        />
        {contentError && (
          <p id="content-error" className="text-sm text-destructive">
            {contentError}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : "작성"}
      </Button>
    </form>
  );
}
