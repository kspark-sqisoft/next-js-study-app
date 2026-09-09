// 글 작성 폼 (클라이언트 컴포넌트). useActionState 로 검증 에러와 pending 상태를 다룬다.
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

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="title">제목</Label>
        {/* 검증 실패 시 서버가 돌려준 입력값을 defaultValue 로 복원한다 */}
        <Input
          id="title"
          name="title"
          maxLength={100}
          required
          defaultValue={state?.fields?.title}
          disabled={pending}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="content">내용</Label>
        <Textarea
          id="content"
          name="content"
          rows={4}
          maxLength={5000}
          required
          defaultValue={state?.fields?.content}
          disabled={pending}
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : "작성"}
      </Button>
    </form>
  );
}
