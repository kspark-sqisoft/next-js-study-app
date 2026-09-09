// 댓글/답글 작성 폼 (클라이언트 컴포넌트).
// postId 와 parentId 를 bind 로 고정한 Server Action 을 useActionState 에 연결한다.
"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCommentAction, type CommentFormState } from "../actions";

type Props = { postId: number; parentId: number | null; placeholder: string };

export function CommentForm({ postId, parentId, placeholder }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<CommentFormState, FormData>(
    addCommentAction.bind(null, postId, parentId),
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) formRef.current?.reset(); // 성공하면 입력창 비우기
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex gap-2">
      <Textarea name="content" rows={2} placeholder={placeholder} maxLength={1000} disabled={pending} className="flex-1" />
      <Button type="submit" size="sm" disabled={pending} className="self-end">
        {parentId === null ? "댓글 작성" : "답글 작성"}
      </Button>
    </form>
  );
}
