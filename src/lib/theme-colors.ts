// 라이트/다크 바탕색을 sRGB 헥스로 옮긴 값. globals.css 의 --background (oklch) 와 같은 색이다.
// 용도: <meta name="theme-color">. iOS Safari 와 안드로이드 크롬은 이 값으로 주소창·상태 표시줄(시계, 배터리) 영역을 칠하는데,
// 이 메타는 oklch() 를 이해하지 못하는 브라우저가 있어 헥스로 적는다. globals.css 의 바탕색을 바꾸면 여기도 맞춘다.
// "use client" 도 "server-only" 도 없는 평범한 모듈이라 루트 레이아웃(서버)과 ThemeColorSync(클라이언트)가 함께 쓴다.
export const THEME_COLORS = {
  light: "#fbfaf7",
  dark: "#0e1218",
} as const;
