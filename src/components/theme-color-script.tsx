// 첫 페인트 전에 <meta name="theme-color"> 를 "실제로 적용될 테마" 색으로 맞추는 인라인 스크립트 (서버 컴포넌트).
//
// 왜 필요한가: next-themes 는 저장된 테마(localStorage "theme")를 자기 인라인 스크립트로 hydration 전에 <html class> 에 반영한다.
// 그런데 layout.tsx 의 viewport.themeColor 메타는 OS 설정(prefers-color-scheme)만 보므로, "OS 는 라이트인데 사이트는 다크"
// 인 사용자는 hydration 이 끝나 ThemeColorSync 가 돌기 전까지 상태 표시줄이 라이트로 남는다. 느린 회선이나 JS 가 늦게
// 실행되는 휴대폰에서 눈에 띈다. next-themes 와 같은 규칙으로 여기서 미리 맞춘다. 실패해도 조용히 넘어간다.
import { THEME_COLORS } from "@/lib/theme-colors";

const script = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);var c=d?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)};var ms=document.querySelectorAll('meta[name="theme-color"]');if(!ms.length){var m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m);ms=[m]}for(var i=0;i<ms.length;i++){ms[i].removeAttribute("media");ms[i].setAttribute("content",c)}}catch(e){}})();`;

export function ThemeColorScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
