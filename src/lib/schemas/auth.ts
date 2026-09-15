// 회원 가입 / 로그인 폼 검증 스키마 (Zod)
import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "이름은 2자 이상 입력하세요.").max(30, "이름은 30자 이하로 입력하세요."),
  email: z.email("올바른 이메일 형식이 아닙니다.").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상 입력하세요.")
    .max(72, "비밀번호는 72자 이하로 입력하세요."),
});

export const loginSchema = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다.").trim().toLowerCase(),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

/** 프로필 수정. 이름 규칙은 가입 때와 같다 (아바타 파일은 uploads-validate 가 검사) */
export const profileSchema = z.object({ name: signupSchema.shape.name });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
