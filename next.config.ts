import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components 활성화.
  // - "use cache" 디렉티브, cacheLife, cacheTag 사용 가능
  // - 기본은 "캐시 안 함". 캐시할 곳만 명시적으로 "use cache" 를 붙인다.
  // - 캐시되지 않은 동적 데이터는 반드시 <Suspense> (또는 loading.tsx) 안에 있어야 한다.
  cacheComponents: true,

  // 경로 패턴만으로 정해지는 리다이렉트. 라우트/파일 시스템보다 먼저 검사된다.
  // permanent: true → 308 (브라우저·검색엔진이 영구 기억), false → 307 (임시)
  async redirects() {
    return [
      // 옛 주소 체계: /blog/3 → /posts/3. :id(\\d{1,}) 는 숫자만 매칭
      { source: "/blog/:id(\\d{1,})", destination: "/posts/:id", permanent: true },
      // 이름이 바뀐 섹션: /articles → /posts (쿼리스트링은 그대로 전달된다)
      { source: "/articles", destination: "/posts", permanent: true },
      // 실제로 URL 을 옮긴 경우: 데모 페이지들을 /posts/* 에서 뺐다 (인터셉팅 라우트와의 충돌 때문, README 2-14)
      { source: "/posts/feed", destination: "/feed", permanent: true },
      { source: "/posts/client", destination: "/client-fetch", permanent: true },
      { source: "/posts/releases", destination: "/releases", permanent: true },
      // 임시 리다이렉트 예 (307): 캠페인 주소처럼 되돌릴 수 있는 것
      { source: "/latest", destination: "/feed", permanent: false },
    ];
  },
};

export default nextConfig;
