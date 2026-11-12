import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

describe("class performance answer heatmap", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("opens a student-by-question answer heatmap from an interaction", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/results";
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "课程结果" })).toBeInTheDocument();
    const interactionRow = await waitFor(() => {
      const row = Array.from(container.querySelectorAll<HTMLButtonElement>(".class-section-row"))
        .find((item) => item.textContent?.includes("问候热身"));
      expect(row).toBeTruthy();
      return row!;
    });
    fireEvent.click(interactionRow);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "答题热力图" })).toBeInTheDocument();
    expect(within(dialog).getByText("平均得分")).toBeInTheDocument();
    expect(within(dialog).getAllByText("题目正确率").length).toBeGreaterThan(0);

    const table = within(dialog).getByRole("table", { name: "学生答题热力图" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("Q1")).toBeInTheDocument();
    expect(within(table).getByText("Q2")).toBeInTheDocument();
    expect(within(table).getByText("题目正确率")).toBeInTheDocument();
    expect(within(table).getAllByText("100%").length).toBeGreaterThan(0);
    expect(table.querySelectorAll(".answer-heatmap-cell.is-correct").length).toBeGreaterThan(0);
    expect(table.querySelectorAll(".answer-heatmap-cell.is-wrong").length).toBeGreaterThan(0);
  });
});
