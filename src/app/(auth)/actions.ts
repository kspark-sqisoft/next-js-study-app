// 회원 가입 / 로그인 / 로그아웃 Server Actions.
// 모두 서버에서만 실행되므로 비밀번호 해시와 세션 쿠키 설정 같은 민감한 작업을 안전하게 할 수 있다.
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/password";
import { loginSchema, signupSchema } from "@/lib/schemas/auth";
import { createSession, deleteSession } from "@/lib/session";
import { createUser, findUserWithHashByEmail } from "@/lib/users";
import { log } from "@/lib/study-log";

export type AuthFormState = {
  errors?: { name?: string[]; email?: string[]; password?: string[]; form?: string[] };
  fields?: { name?: string; email?: string };
} | null;

export async function signupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  log.action("signupAction 시작 (비밀번호는 로그에 남기지 않는다)");
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  // 1. 검증
  const result = signupSchema.safeParse(raw);
  if (!result.success) {
    log.action("  ↳ 검증 실패 → 폼 에러 반환", Object.keys(z.flattenError(result.error).fieldErrors));
    return { errors: z.flattenError(result.error).fieldErrors, fields: { name: raw.name, email: raw.email } };
  }
  const { name, email, password } = result.data;

  // 2. 중복 확인
  if (findUserWithHashByEmail(email)) {
    log.action(`  ↳ 중복 이메일 (${email}) → 폼 에러 반환`);
    return { errors: { email: ["이미 가입된 이메일입니다."] }, fields: { name, email } };
  }

  // 3. 비밀번호는 해시해서 저장. 원문은 어디에도 남기지 않는다
  const user = createUser(name, email, await hashPassword(password));
  log.action(`  ↳ 사용자 #${user.id} 생성 (scrypt 해시 저장) → 세션 발급 → redirect(/posts)`);

  // 4. 세션 쿠키 발급 → 5. 이동
  await createSession(user.id);
  redirect("/posts");
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  log.action("loginAction 시작");
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const result = loginSchema.safeParse(raw);
  if (!result.success) {
    return { errors: z.flattenError(result.error).fieldErrors, fields: { email: raw.email } };
  }
  const { email, password } = result.data;

  // 이메일이 없어도, 비밀번호가 틀려도 같은 메시지를 준다.
  // "가입된 이메일인지" 를 알려 주면 계정 존재 여부를 탐색하는 데 쓰일 수 있다.
  const user = findUserWithHashByEmail(email);
  const ok = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !ok) {
    log.action(`  ↳ 실패: ${!user ? "이메일 없음" : "비밀번호 불일치"} — 사용자에게는 같은 메시지 (계정 열거 방지)`);
    return { errors: { form: ["이메일 또는 비밀번호가 올바르지 않습니다."] }, fields: { email } };
  }

  log.action(`  ↳ 성공: userId=${user.id} → 세션 발급 → redirect(/posts)`);
  await createSession(user.id);
  redirect("/posts");
}

export async function logoutAction() {
  log.action("logoutAction — 서버 컴포넌트의 <form action> 으로 호출됨 → 세션 삭제 → redirect(/)");
  await deleteSession();
  redirect("/");
}
