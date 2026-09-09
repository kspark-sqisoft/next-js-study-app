// template.tsx: layout 과 같은 자리에서 페이지를 감싸지만, "이 레벨의 세그먼트가 바뀔 때마다 새로 마운트" 된다.
// - 위의 layout.tsx 는 /feed → /releases 로 옮겨도 그대로 유지된다 (네비게이션 바가 깜빡이지 않는 이유).
// - template.tsx 는 자식 세그먼트(feed → releases)가 바뀌면 새 key 로 다시 만들어지므로
//   진입 애니메이션이 이동할 때마다 재생되고, 그 안의 클라이언트 state 와 useEffect 도 초기화된다.
// 렌더링 순서: layout > template > (error > loading > not-found >) page
export default function DemosTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="demos-template">
      {children}
    </div>
  );
}
