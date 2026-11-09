import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

describe("academic affairs workspace", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("shows four role cards on login and exposes the academic role", () => {
    window.location.hash = "#/login";
    render(<App />);
    expect(screen.getByRole("heading", { name: "学校教务端" })).toBeInTheDocument();
    expect(screen.getByText("四角色课堂教学管理原型")).toBeInTheDocument();
    expect(screen.getByText("排课、管理本校学生与考务，并按教师维度观察学习结果。")).toBeInTheDocument();
  });

  it("renders an isolated academic navigation without catalog or governance", async () => {
    platform.setCurrentUser("academic-shengxin");
    refreshAppStore();
    window.location.hash = "#/academic";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "印尼圣心学校教学运行中心" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /排课管理/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /班级与学生/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /教师表现/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /课程目录/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /内容治理/ })).not.toBeInTheDocument();
  });

  it("redirects hidden academic content routes back to the dashboard", async () => {
    platform.setCurrentUser("academic-shengxin");
    refreshAppStore();
    window.location.hash = "#/academic/catalog";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "印尼圣心学校教学运行中心" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe("#/academic"));
  });

  it("shows a ranked teacher performance table with school-scoped data", async () => {
    platform.setCurrentUser("academic-shengxin");
    refreshAppStore();
    window.location.hash = "#/academic/performance";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "教师表现" })).toBeInTheDocument();
    expect(screen.getAllByText("Lina 老师").length).toBeGreaterThan(0);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText(/导出不包含学生姓名/)).toBeInTheDocument();
  });
});
