// 로그인/회원가입 공용 폼 (클라이언트 컴포넌트).
// mode 에 따라 이름 입력란과 호출할 Server Action 이 달라진다.
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, signupAction, type AuthFormState } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? loginAction : signupAction,
    null,
  );
  const err = state?.errors;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <h1 className="text-xl font-semibold">{mode === "login" ? "로그인" : "회원 가입"}</h1>

      {mode === "signup" && (
        <Field id="name" label="이름" error={err?.name?.[0]}>
          <Input id="name" name="name" defaultValue={state?.fields?.name} disabled={pending} autoComplete="name" />
        </Field>
      )}
      <Field id="email" label="이메일" error={err?.email?.[0]}>
        <Input id="email" name="email" type="email" defaultValue={state?.fields?.email} disabled={pending} autoComplete="email" />
      </Field>
      <Field id="password" label="비밀번호" error={err?.password?.[0]}>
        <Input
          id="password"
          name="password"
          type="password"
          disabled={pending}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </Field>

      {/* 특정 필드가 아닌 폼 전체 에러 (예: 이메일 또는 비밀번호 불일치) */}
      {err?.form?.[0] && <p className="text-sm text-destructive">{err.form[0]}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "처리 중..." : mode === "login" ? "로그인" : "가입하기"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>계정이 없나요? <Link href="/signup" className="underline">회원 가입</Link></>
        ) : (
          <>이미 계정이 있나요? <Link href="/login" className="underline">로그인</Link></>
        )}
      </p>
      {mode === "login" && (
        <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
          샘플 계정: demo@example.com / password123 (게스트: guest@example.com)
        </p>
      )}
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
