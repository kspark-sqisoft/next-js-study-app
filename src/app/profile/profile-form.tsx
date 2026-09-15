// 프로필 수정 폼 (클라이언트 컴포넌트). useActionState 로 updateProfileAction 과 연결한다.
// 파일 입력이 있으므로 <form> 은 자동으로 multipart 로 전송되고, 액션은 formData.get("avatar") 로 File 을 받는다.
"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction, type ProfileFormState } from "./actions";

type Props = { user: { name: string; email: string; avatarPath: string | null } };

export function ProfileForm({ user }: Props) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(updateProfileAction, null);

  useEffect(() => {
    if (state?.ok) toast.success("프로필을 저장했습니다.");
  }, [state]);

  const nameError = state?.errors?.name?.[0];
  const avatarError = state?.errors?.avatar?.[0];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="flex items-start gap-5">
        {/* 저장 뒤 서버가 새 props 를 내려보내므로 여기 이미지는 자동으로 바뀐다 */}
        <Avatar name={user.name} avatarPath={user.avatarPath} size="lg" />
        <div className="flex-1 space-y-2">
          <Label htmlFor="avatar">아바타 이미지 (2MB 이하)</Label>
          <Input
            id="avatar"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={pending}
            aria-invalid={avatarError ? true : undefined}
          />
          {avatarError && <p className="text-sm text-destructive">{avatarError}</p>}
          {user.avatarPath && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="removeAvatar" className="accent-primary" /> 현재 아바타 삭제 (새 파일을 고르면 교체됩니다)
            </label>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="name">이름</Label>
        <Input
          id="name"
          name="name"
          defaultValue={state?.fields?.name ?? user.name}
          disabled={pending}
          autoComplete="name"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "name-error" : undefined}
        />
        {nameError && <p id="name-error" className="text-sm text-destructive">{nameError}</p>}
        <p className="text-xs text-muted-foreground">글과 댓글의 작성자 표시에 쓰입니다.</p>
      </div>

      <div className="space-y-1">
        <Label>이메일</Label>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
