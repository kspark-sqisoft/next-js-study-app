// DAL (Data Access Layer) 의 인증 부분.
// "지금 요청을 보낸 사용자가 누구인가" 를 확인하는 함수를 한 곳에 두고,
// 데이터를 읽거나 바꾸는 모든 곳(서버 컴포넌트, Server Action, Route Handler)에서 이 함수를 쓴다.
// 공식 문서가 가장 강조하는 원칙: 권한 검사는 데이터에 가장 가까운 곳에서 한다.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { findUserById, type User } from "@/lib/users";

/**
 * 현재 로그인한 사용자. 없으면 null.
 * React cache(): 한 번의 렌더링 안에서 여러 컴포넌트가 호출해도 쿠키 검증과 DB 조회는 한 번만 한다.
 * cookies() 를 읽으므로 Cache Components 에서는 <Suspense> 안에서만 호출할 수 있다.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return findUserById(userId); // 탈퇴 등으로 사용자가 없어졌으면 null
});

/** 로그인이 꼭 필요한 곳에서 사용. 없으면 로그인 페이지로 보낸다. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
