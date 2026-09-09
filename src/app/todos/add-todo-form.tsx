// 할 일 추가 폼 (클라이언트 컴포넌트).
// 입력 상태, 로딩 표시, 토스트 알림 등 브라우저 상호작용이 필요해서 "use client".
"use client";

import { useActionState, useEffect, useRef } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTodoAction, type ActionState } from "./actions";

export function AddTodoForm() {
  const formRef = useRef<HTMLFormElement>(null);

  // useActionState: Server Action 을 폼에 연결하고 [결과 상태, 액션, 진행 중 여부] 를 돌려준다.
  // 액션을 한 겹 감싸서 성공 시 폼 초기화 + 토스트를 처리한다.
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await addTodoAction(prev, formData); // 서버에서 실행됨
      if (!result?.error) {
        formRef.current?.reset(); // 입력창 비우기
        toast.success("할 일을 추가했습니다.");
      }
      return result;
    },
    null, // 초기 상태
  );

  // 서버가 에러를 돌려주면 토스트로 표시
  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    // action 에 함수를 넘기면 submit 시 FormData 가 자동으로 전달된다.
    <form ref={formRef} action={formAction} className="flex gap-2">
      <Input
        name="title" // formData.get("title") 로 읽히는 키
        placeholder="할 일을 입력하세요"
        autoComplete="off"
        maxLength={200}
        required
        disabled={pending} // 전송 중에는 잠금
        aria-invalid={state?.error ? true : undefined}
      />
      <Button type="submit" disabled={pending}>
        <PlusIcon data-icon="inline-start" />
        추가
      </Button>
    </form>
  );
}
