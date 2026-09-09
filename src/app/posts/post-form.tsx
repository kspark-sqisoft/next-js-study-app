// 글 작성/수정 공용 폼 (클라이언트 컴포넌트).
// action 을 props 로 받으므로 작성(createPostAction)과 수정(updatePostAction.bind(null, id)) 에 모두 쓴다.
// useActionState 로 서버가 돌려준 필드별 에러(Zod)와 pending 상태를 다룬다.
// 파일 입력이 있으면 <form> 은 자동으로 multipart 로 전송되고, 서버 액션은 formData.get("image") 로 File 을 받는다.
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PostFormState } from "./actions";

type Props = {
  action: (prev: PostFormState, formData: FormData) => Promise<PostFormState>;
  initial?: { title: string; content: string; imageUrl?: string | null };
  submitLabel: string;
};

export function PostForm({ action, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(action, null);

  // 필드별 첫 번째 에러 메시지
  const titleError = state?.errors?.title?.[0];
  const contentError = state?.errors?.content?.[0];
  const imageError = state?.errors?.image?.[0];
  const formError = state?.errors?.form?.[0];

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {/* noValidate: 브라우저 기본 검증을 끄고 서버(Zod) 검증 결과만 보여 준다. 학습용. */}
      <div className="space-y-1">
        <Label htmlFor="title">제목</Label>
        {/* 검증 실패 시 서버가 돌려준 입력값을, 처음엔 initial 을 defaultValue 로 쓴다 */}
        <Input
          id="title"
          name="title"
          defaultValue={state?.fields?.title ?? initial?.title}
          disabled={pending}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "title-error" : undefined}
        />
        {titleError && <p id="title-error" className="text-sm text-destructive">{titleError}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="content">내용</Label>
        <Textarea
          id="content"
          name="content"
          rows={6}
          defaultValue={state?.fields?.content ?? initial?.content}
          disabled={pending}
          aria-invalid={contentError ? true : undefined}
          aria-describedby={contentError ? "content-error" : undefined}
        />
        {contentError && <p id="content-error" className="text-sm text-destructive">{contentError}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="image">이미지 (선택, 2MB 이하)</Label>
        <Input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={pending} />
        {imageError && <p className="text-sm text-destructive">{imageError}</p>}
        {initial?.imageUrl && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="removeImage" /> 현재 이미지 삭제 (새 파일을 고르면 교체됩니다)
          </label>
        )}
      </div>
      {formError && <p className="text-sm text-destructive">{formError}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : submitLabel}
      </Button>
    </form>
  );
}
