// next/dynamic 로더 (클라이언트 컴포넌트).
// ssr: false 는 클라이언트 컴포넌트 안에서만 쓸 수 있으므로, 서버 컴포넌트(page.tsx)가 직접 dynamic() 을 부르지 않고
// 이 얇은 래퍼를 거친다. 결과: RecentlyViewed 의 JS 는 별도 청크로 분리되고, 서버 HTML 에는 포함되지 않으며,
// 브라우저에서 hydration 뒤에 로드된다 (Network 탭에서 별도 chunk 요청을 볼 수 있다).
"use client";

import dynamic from "next/dynamic";

const RecentlyViewed = dynamic(() => import("./recently-viewed"), {
  ssr: false,
  loading: () => <div className="h-6" aria-hidden />, // 로드되는 동안 자리 유지
});

export function RecentlyViewedLoader(props: { currentId: number; currentTitle: string }) {
  return <RecentlyViewed {...props} />;
}
