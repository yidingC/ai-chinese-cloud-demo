import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

describe("operator dashboard", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("keeps the homepage focused on upcoming classes, today and todos", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator";
    render(<App />);

    const state = platform.getState();
    const now = Date.now();
    const activeClasses = state.classes.filter((classItem) => classItem.status === "active");
    const weekSessions = state.sessions.filter(
      (session) =>
        session.status === "published" &&
        new Date(session.endAt).getTime() >= now &&
        new Date(session.startAt).getTime() <= now + 7 * 24 * 60 * 60 * 1000
    );

    expect(await screen.findByRole("heading", { level: 1, name: "运营工作台" })).toBeInTheDocument();
    expect(
      screen.getByText(`在运营 ${activeClasses.length} 个班 · 未来 7 天 ${weekSessions.length} 节课`)
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "接下来开课" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "今天课堂" })).toBeInTheDocument();
    const scheduleCta = screen.getByRole("button", { name: "去排课" });
    expect(scheduleCta).toHaveClass("operator-schedule-cta");

    expect(screen.queryByText("给班级安排下一节课")).not.toBeInTheDocument();
    expect(screen.queryByText("日常主链")).not.toBeInTheDocument();
    expect(screen.queryByText("按顺序推进")).not.toBeInTheDocument();
    expect(screen.queryByText("待处理")).not.toBeInTheDocument();

    fireEvent.click(scheduleCta);
    await waitFor(() => expect(window.location.hash).toBe("#/operator/scheduling"));
    expect(await screen.findByRole("dialog", { name: "排课" })).toBeInTheDocument();
  });
});
