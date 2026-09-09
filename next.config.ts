import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components 활성화.
  // - "use cache" 디렉티브, cacheLife, cacheTag 사용 가능
  // - 기본은 "캐시 안 함". 캐시할 곳만 명시적으로 "use cache" 를 붙인다.
  // - 캐시되지 않은 동적 데이터는 반드시 <Suspense> (또는 loading.tsx) 안에 있어야 한다.
  cacheComponents: true,
};

export default nextConfig;
