import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("renders the answer heatmap on the page and drills into question accuracy", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/results";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "课程结果" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "答题热力图" })).toBeInTheDocument();
    expect(screen.getByText("本课互动均分")).toBeInTheDocument();
    expect(screen.getByText("77.4")).toBeInTheDocument();

    const table = await screen.findByRole("table", { name: "课堂表现答题矩阵" });
    expect(table.querySelectorAll(".performance-cell").length).toBeGreaterThan(0);
    expect(
      table.querySelectorAll(
        ".performance-cell.tone-mint, .performance-cell.tone-blue, .performance-cell.tone-orange, .performance-cell.tone-danger"
      ).length
    ).toBeGreaterThan(0);

    const columns = table.querySelectorAll<HTMLButtonElement>(".performance-column-button:not(.is-static)");
    expect(columns.length).toBeGreaterThan(0);
    fireEvent.click(columns[0]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "逐题正确率" })).toBeInTheDocument();
    expect(within(dialog).getAllByText(/人答对/).length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();
  });
});
