// @modal 슬롯의 기본값. 인터셉트가 일어나지 않은 상태(/posts 목록 자체, 새로고침) 에서 렌더링된다.
// null 을 돌려줘야 "모달 없음" 상태가 된다. 이 파일이 없으면 슬롯이 매칭되지 않을 때 404 가 난다.
export default function ModalDefault() {
  return null;
}
