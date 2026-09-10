// 컴포넌트 테스트: 클라이언트 컴포넌트가 Server Action 을 import 할 때는 vi.mock 으로 액션 모듈을 통째로 바꾼다.
// 실제 액션은 DB 와 revalidatePath 에 의존하므로 단위 테스트에서 실행하면 안 된다.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./actions", () => ({
  toggleTodoAction: vi.fn(async () => {}),
  deleteTodoAction: vi.fn(async () => {}),
  renameTodoAction: vi.fn(async () => null),
}));

const actions = await import("./actions");
const { TodoItem } = await import("./todo-item");

const todo = { id: 1, title: "공부하기", completed: false, createdAt: "2026-01-01" };

describe("<TodoItem />", () => {
  it("제목을 보여 주고, 완료면 취소선 스타일을 붙인다", async () => {
    const { rerender } = render(<TodoItem todo={todo} />);
    expect(screen.getByText("공부하기")).not.toHaveClass("line-through");
    rerender(<TodoItem todo={{ ...todo, completed: true }} />);
    expect(screen.getByText("공부하기")).toHaveClass("line-through");
  });

  it("체크박스를 누르면 toggleTodoAction 을 id 와 함께 호출한다", async () => {
    render(<TodoItem todo={todo} />);
    // 체크박스가 둘이다: 선택용(native input, aria-label="선택") 과 완료용(shadcn Checkbox). 완료용만 고른다
    const completedBox = screen.getAllByRole("checkbox").find((el) => el.getAttribute("aria-label") !== "선택")!;
    await userEvent.click(completedBox);
    expect(actions.toggleTodoAction).toHaveBeenCalledWith(1, true);
  });

  it("삭제 버튼은 deleteTodoAction 을 호출한다", async () => {
    render(<TodoItem todo={todo} />);
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(actions.deleteTodoAction).toHaveBeenCalledWith(1);
  });

  it("수정 버튼을 누르면 입력창이 나타난다", async () => {
    render(<TodoItem todo={todo} />);
    await userEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(screen.getByDisplayValue("공부하기")).toBeInTheDocument();
  });
});
