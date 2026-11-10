import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

function loginAsAcademic() {
  platform.setCurrentUser("academic-shengxin");
  refreshAppStore();
}

describe("academic affairs workspace", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("shows four role cards on login and describes the academic role as read-only intake", () => {
    window.location.hash = "#/login";
    render(<App />);
    expect(screen.getByRole("heading", { name: "学校教务端" })).toBeInTheDocument();
    expect(screen.getByText("四角色课堂教学管理原型")).toBeInTheDocument();
    expect(screen.getByText("查看本校班级与学生信息、课程安排，并录入新生。")).toBeInTheDocument();
    expect(screen.getByText("学生预约 · 教师设计 · 学校教务监督")).toBeInTheDocument();
  });

  it("renders the academic dashboard without review queues, scheduling actions, or hidden content routes", async () => {
    loginAsAcademic();
    window.location.hash = "#/academic";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "印尼圣心学校教学运行中心" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /课程日历/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /班级与学生/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /教师表现/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /操作日志/ })).not.toBeInTheDocument();
    const sidebar = document.querySelector(".sidebar-nav") as HTMLElement;
    expect(Array.from(sidebar.querySelectorAll("a > span")).map((node) => node.textContent)).toEqual([
      "首页",
      "课程日历",
      "班级与学生",
      "课堂表现",
      "学生成绩",
      "消息"
    ]);
    expect(sidebar.querySelectorAll(".sidebar-nav-group")).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "接下来开课" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "课程日历" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本周课程日历" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "班级概览" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重置演示数据/ })).toBeInTheDocument();
    expect(screen.queryByText(/报名审核待办/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新建班次/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /课程目录/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /内容治理/ })).not.toBeInTheDocument();
  });

  it("shows school-scoped upcoming classes and the calendar on the academic dashboard", async () => {
    const state = platform.getState();
    const foreignClassNames = state.classes
      .filter((item) => item.schoolId !== "school-sacred-heart")
      .map((item) => item.name);
    expect(foreignClassNames.length).toBeGreaterThan(0);

    loginAsAcademic();
    window.location.hash = "#/academic";
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "接下来开课" })).toBeInTheDocument();
    const upcomingRows = [...container.querySelectorAll<HTMLButtonElement>(".teacher-upcoming-list > button")];
    expect(upcomingRows.length).toBeGreaterThan(0);
    expect(upcomingRows.length).toBeLessThanOrEqual(5);
    upcomingRows.forEach((row) => {
      const text = row.textContent ?? "";
      foreignClassNames.forEach((name) => expect(text).not.toContain(name));
    });

    fireEvent.click(upcomingRows[0]);
    const rosterDialog = await screen.findByRole("dialog", { name: /课次名单/ });
    expect(within(rosterDialog).getByText("只读查看")).toBeInTheDocument();
    fireEvent.click(within(rosterDialog).getByRole("button", { name: "关闭" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /课次名单/ })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /打开完整课程日历/ }));
    expect(await screen.findByRole("dialog", { name: /课程日历/ })).toBeInTheDocument();
  });

  it("jumps from the academic focus card to the highlighted session in the course calendar", async () => {
    loginAsAcademic();
    window.location.hash = "#/academic";
    const { container } = render(<App />);

    const focusCard = await waitFor(() => {
      const card = container.querySelector<HTMLElement>(".academic-focus-card.is-clickable");
      expect(card).not.toBeNull();
      return card!;
    });
    const focusButton = within(focusCard).getByRole("button", { name: /^在课程日历中查看 / });
    const sessionId = focusButton.getAttribute("data-session-id");
    expect(sessionId).toBeTruthy();
    fireEvent.click(focusButton);

    await waitFor(() => expect(window.location.hash).toBe("#/academic/scheduling"));
    await waitFor(() => {
      const highlighted = container.querySelector<HTMLElement>(".operator-session-card.is-focused");
      expect(highlighted).not.toBeNull();
      expect(highlighted).toHaveAttribute("data-session-id", sessionId);
    });
  });

  it("renders the academic course calendar without scheduling controls and opens the calendar", async () => {
    loginAsAcademic();
    window.location.hash = "#/academic/scheduling";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "课程日历" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^排课$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /安排系列课/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/教师申请/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /打开课程日历/ }));
    const dialog = await screen.findByRole("dialog", { name: /课程日历/ });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "查看名单" })).toBeInTheDocument();
  });

  it("shows read-only session rosters without sync, intake, or removal controls", async () => {
    loginAsAcademic();
    window.location.hash = "#/academic/scheduling?focus=session-live";
    render(<App />);

    const rosterButtons = await screen.findAllByRole("button", { name: "查看名单" });
    fireEvent.click(rosterButtons[0]);
    const dialog = await screen.findByRole("dialog", { name: /课次名单/ });
    expect(within(dialog).getByText("只读查看")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("搜索姓名、手机号或 App 账号")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /同步名单/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /补录学生/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /移出/ })).not.toBeInTheDocument();
  });

  it("shows classes before students read-only, with a required primary class when adding a student", async () => {
    loginAsAcademic();
    window.location.hash = "#/academic/students";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "班级与学生" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent("班级");
    expect(tabs[1]).toHaveTextContent("学生");
    expect((await screen.findAllByRole("button", { name: "查看名单" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /管理学生/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /编辑班级/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新建学生/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新建班级/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /新建学生/ }));
    const dialog = await screen.findByRole("dialog", { name: "新建学生档案" });
    expect(within(dialog).getByLabelText("主班级")).toBeInTheDocument();
    expect(within(dialog).getByText("学校教务只能把学生加入本校已有班级")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));

    fireEvent.click(screen.getByRole("tab", { name: "学生" }));
    expect((await screen.findAllByRole("button", { name: /查看完整档案/ })).length).toBeGreaterThan(0);
  });

  it("opens complete student records without academic editing, proxy booking, or grade actions", async () => {
    loginAsAcademic();
    window.location.hash = "#/academic/students/student-anisa";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Anisa", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("只读档案")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /编辑档案/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /去代约课程/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /成绩与结果/ }));
    expect(screen.queryByRole("button", { name: /新建考核/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /补录/ })).not.toBeInTheDocument();
  });

  it("shows school-scoped classroom performance and only completed own-school sessions", async () => {
    const state = platform.getState();
    const completedOwnSessions = state.sessions.filter(
      (session) =>
        session.schoolId === "school-sacred-heart"
        && session.status === "published"
        && new Date(session.endAt).getTime() < Date.now()
    );
    expect(completedOwnSessions.length).toBeGreaterThan(0);

    loginAsAcademic();
    window.location.hash = "#/academic/results";
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "课堂表现" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "课堂表现" })).toHaveAttribute("href", "#/academic/results");
    expect(screen.getByText("只读查看")).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelectorAll(".analytics-session-list button")).toHaveLength(completedOwnSessions.length);
    });
    expect(screen.queryByRole("button", { name: /新建|编辑|取消|移出/ })).not.toBeInTheDocument();
  });

  it("shows a school-scoped, read-only student gradebook", async () => {
    const state = platform.getState();
    const ownClasses = state.classes.filter(
      (item) => item.schoolId === "school-sacred-heart" && item.status === "active"
    );
    const foreignClasses = state.classes.filter(
      (item) => item.schoolId !== "school-sacred-heart" && item.status === "active"
    );
    const ownStudentIds = new Set(
      state.schoolMemberships
        .filter((item) => item.schoolId === "school-sacred-heart" && item.role === "student" && item.status === "active")
        .map((item) => item.userId)
    );
    const foreignStudentNames = state.users
      .filter((item) => item.role === "student" && !ownStudentIds.has(item.id))
      .map((item) => item.name);
    expect(ownClasses.length).toBeGreaterThan(0);
    expect(foreignClasses.length).toBeGreaterThan(0);
    expect(foreignStudentNames.length).toBeGreaterThan(0);

    loginAsAcademic();
    window.location.hash = "#/academic/grades";
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "学生成绩" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "学生成绩" })).toHaveAttribute("href", "#/academic/grades");
    expect(screen.getByText("只读查看")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "印尼圣心学校学生成绩汇总" })).toBeInTheDocument();
    expect(screen.getByText("当前权重：互动 35% · 作业 35% · 考试 30%")).toBeInTheDocument();

    const classSelect = screen.getByLabelText("按班级筛选");
    ownClasses.forEach((item) => {
      expect(within(classSelect).getByRole("option", { name: item.name })).toBeInTheDocument();
    });
    foreignClasses.forEach((item) => {
      expect(within(classSelect).queryByRole("option", { name: item.name })).not.toBeInTheDocument();
    });
    const workspaceText = container.querySelector(".workspace-content")?.textContent ?? "";
    foreignStudentNames.forEach((name) => expect(workspaceText).not.toContain(name));

    const studentRows = await waitFor(() => {
      const rows = container.querySelectorAll<HTMLButtonElement>(".grade-student-table .data-table-row");
      expect(rows.length).toBeGreaterThan(0);
      return rows;
    });
    fireEvent.click(studentRows[0]);

    const dialog = await screen.findByRole("dialog", { name: /成绩详情/ });
    expect(within(dialog).getByRole("heading", { name: "成绩趋势" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /编辑|录入|补录|发布|删除/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新建考核|发布成绩|批量录分/ })).not.toBeInTheDocument();
  });

  it("opens a requested academic classroom session and shows its teacher", async () => {
    const state = platform.getState();
    const completedOwnSessions = state.sessions
      .filter(
        (session) =>
          session.schoolId === "school-sacred-heart"
          && session.status === "published"
          && new Date(session.endAt).getTime() < Date.now()
      )
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    const requested = completedOwnSessions[completedOwnSessions.length - 1];
    const teacher = state.users.find((user) => user.id === requested.teacherId)!;

    loginAsAcademic();
    window.location.hash = `#/academic/results?sessionId=${requested.id}`;
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { level: 2, name: requested.title })).toBeInTheDocument();
    expect(screen.getAllByText(teacher.name).length).toBeGreaterThan(0);
    expect(container.querySelector(`.analytics-session-list .active`)?.textContent).toContain(requested.title);
  });

  it("opens classroom performance from an ended course card", async () => {
    const state = platform.getState();
    const ended = state.sessions
      .filter(
        (session) =>
          session.schoolId === "school-sacred-heart"
          && session.status === "published"
          && new Date(session.endAt).getTime() < Date.now()
      )
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];

    loginAsAcademic();
    window.location.hash = `#/academic/scheduling?focus=${ended.id}`;
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "课程日历" })).toBeInTheDocument();
    const card = container.querySelector(`[data-session-id="${ended.id}"]`) as HTMLElement;
    expect(card).not.toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "查看课堂表现" }));

    expect(await screen.findByRole("heading", { name: "课堂表现" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: ended.title })).toBeInTheDocument();
  });

  it("redirects retired academic routes back to the dashboard", async () => {
    loginAsAcademic();
    window.location.hash = "#/academic/catalog";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "印尼圣心学校教学运行中心" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe("#/academic"));

    for (const retiredRoute of ["#/academic/performance", "#/academic/performance/teacher-lina", "#/academic/audit"]) {
      window.location.hash = retiredRoute;
      await waitFor(() => expect(window.location.hash).toBe("#/academic"));
      expect(await screen.findByRole("heading", { name: "印尼圣心学校教学运行中心" })).toBeInTheDocument();
    }
  });
});
