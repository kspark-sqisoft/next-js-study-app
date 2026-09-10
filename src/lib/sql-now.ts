// SQLite 의 datetime('now') 와 같은 형식("YYYY-MM-DD HH:MM:SS", UTC)의 현재 시각 문자열.
// 기존 DB 는 날짜를 이 형식의 TEXT 로 저장하므로, Prisma 로 UPDATE 할 때도 같은 형식을 써서 섞이지 않게 한다.
export function sqlNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
