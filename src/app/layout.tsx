// 루트 레이아웃. 모든 페이지를 감싸는 최상위 컴포넌트로 <html>, <body> 를 여기서 정의한다.
// 페이지 이동 시 다시 렌더링되지 않고 유지된다.
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css"; // Tailwind 및 전역 스타일
import { RecentlyViewedBadge } from "@/components/recently-viewed-badge";
import { StoreHydrator } from "@/components/store-hydrator";
import { Toaster } from "@/components/ui/sonner";
import { UserMenu } from "@/components/user-menu";

// Google Fonts 를 빌드 시 다운로드해 셀프 호스팅. CSS 변수로 노출된다.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 기본 메타데이터. 각 page.tsx 에서 덮어쓸 수 있다.
export const metadata: Metadata = {
  title: "Next.js Study App",
  description: "Next.js 16 + TypeScript + shadcn/ui study project",
};

// children 자리에 현재 경로의 page.tsx 가 들어온다.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="font-semibold">Next.js Study</Link>
            <Link href="/todos" className="hover:underline">할 일</Link>
            <Link href="/posts" className="hover:underline">
              글<RecentlyViewedBadge />
            </Link>
          </nav>
          {/* 세션을 읽는 부분만 Suspense 로 감싼다. 레이아웃 최상위에서 세션을 await 하면
              모든 페이지가 세션 확인을 기다리게 되므로 반드시 컴포넌트 안으로 밀어 넣는다. */}
          <Suspense fallback={<div className="h-8 w-24" />}>
            <UserMenu />
          </Suspense>
        </header>
        {children}
        {/* 토스트 알림 표시 영역. 어디서든 toast() 를 호출하면 여기에 뜬다. */}
        <Toaster />
        {/* persist 스토어(최근 본 글)를 마운트 후 localStorage 에서 복원 */}
        <StoreHydrator />
      </body>
    </html>
  );
}
