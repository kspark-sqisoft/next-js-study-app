// 현재 섹션을 표시하는 링크 (클라이언트 컴포넌트).
// usePathname 은 브라우저의 현재 URL 을 읽는 훅이라 클라이언트 컴포넌트에서만 쓸 수 있다.
// 서버 컴포넌트(site-header.tsx, posts-nav.tsx)가 이 컴포넌트를 자식으로 두고 href 만 넘긴다.
//
// 활성 판단:
// - exact 가 아니면 "그 경로 자체" 또는 "그 아래 경로" (/posts 는 /posts/3 에서도 활성)
// - exact 면 정확히 같을 때만 (홈 "/" 는 다른 모든 경로의 접두사라서 exact 로 써야 한다)
// - /posts-archive 처럼 접두사만 같은 경로는 활성이 아니다 (뒤에 "/" 가 와야 하위 경로)
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Link> & {
  href: string;
  exact?: boolean;
  /** 활성일 때만 추가되는 클래스 */
  activeClassName?: string;
};

export function NavLink({ href, exact = false, className, activeClassName, ...props }: Props) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined} // 스크린 리더와 CSS([aria-current]) 모두에 "현재 위치" 를 알린다
      className={cn(className, active && activeClassName)}
      {...props}
    />
  );
}
