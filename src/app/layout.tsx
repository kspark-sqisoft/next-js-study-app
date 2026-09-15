// 루트 레이아웃. 모든 페이지를 감싸는 최상위 컴포넌트로 <html>, <body> 를 여기서 정의한다.
// 페이지 이동 시 다시 렌더링되지 않고 유지된다.
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css"; // Tailwind 및 전역 스타일
import { SiteHeader } from "@/components/site-header";
import { StoreHydrator } from "@/components/store-hydrator";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/client";

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
    // suppressHydrationWarning: next-themes 가 브라우저에서 <html class="dark"> 를 붙이므로
    // 서버 HTML 과 첫 렌더가 이 속성 하나만 다르다. 그 차이는 무시하라고 알린다 (이 요소 한 단계에만 적용).
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* 테마 Provider 와 tRPC + TanStack Query Provider. 둘 다 클라이언트 컴포넌트지만
            안의 헤더와 페이지는 여전히 서버 컴포넌트다 (children 샌드위치). 댓글(/posts/[id])과 데모 페이지가 tRPC 를 쓰므로 루트에 둔다 */}
        <ThemeProvider>
          <TRPCReactProvider>
            <SiteHeader />
            {children}
            <footer className="mt-auto border-t border-border/70">
              <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
                <span>Next.js 16 학습용 실험실</span>
                <span>설명서는 README 와 docs/CODE_WALKTHROUGH.md 에 있다</span>
              </div>
            </footer>
            {/* 토스트 알림 표시 영역. 어디서든 toast() 를 호출하면 여기에 뜬다. */}
            <Toaster />
            {/* persist 스토어(최근 본 글)를 마운트 후 localStorage 에서 복원 */}
            <StoreHydrator />
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
