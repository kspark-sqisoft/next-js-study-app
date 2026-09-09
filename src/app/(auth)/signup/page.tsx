import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "회원 가입 | Next.js Study App" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
