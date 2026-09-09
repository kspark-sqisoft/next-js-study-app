import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "로그인 | Next.js Study App" };

// 세션을 읽지 않는 정적 페이지. "이미 로그인한 사용자를 /posts 로 보내는" 일은 src/proxy.ts 가 한다.
export default function LoginPage() {
  return <AuthForm mode="login" />;
}
