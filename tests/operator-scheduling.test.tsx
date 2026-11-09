import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

function expectedStatusLabel(
  session: { status: string; startAt: string; endAt: string },
  now: number
) {
  if (session.status === "cancelled") return "已取消";
  if (new Date(session.startAt).getTime() > now) return "未开始";
  if (new Date(session.endAt).getTime() < now) return "已结束";
  return "进行中";
}

function dateKeyInTimeZone(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

describe("operator scheduling", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("splits single sessions into upcoming and history by end time", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    const { container } = render(<App />);

    const state = platform.getState();
    const now = Date.now();
    const singleSessions = state.sessions.filter((session) => session.source === "single");
    const upcoming = singleSessions
      .filter((session) => session.status !== "cancelled" && new Date(session.endAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    const history = singleSessions
      .filter((session) => session.status === "cancelled" || new Date(session.endAt).getTime() < now)
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    expect(upcoming.length).toBeGreaterThan(0);
    expect(history.length).toBeGreaterThan(0);

    const upcomingTab = await screen.findByRole("tab", { name: /即将开始/ });
    const historyTab = screen.getByRole("tab", { name: /历史课程/ });
    const allTab = screen.getByRole("tab", { name: /^全部/ });
    expect(screen.getByRole("button", { name: "排课" }).closest(".schedule-time-tabs"))
      .not.toBeNull();
    expect(screen.queryByRole("tab", { name: /单次课次|系列课程/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /安排系列课/ })).not.toBeInTheDocument();
    expect(upcomingTab).toHaveAttribute("aria-selected", "true");
    expect(upcomingTab).toHaveTextContent(String(upcoming.length));
    expect(screen.queryByText(/筛选后 .* 个课次/)).not.toBeInTheDocument();
    expect(screen.getByText(upcoming[0].title)).toBeInTheDocument();
    expect(screen.queryByText(history[0].title)).not.toBeInTheDocument();
    const firstCard = screen.getByText(upcoming[0].title).closest(".operator-session-card");
    expect(firstCard).toHaveTextContent(expectedStatusLabel(upcoming[0], now));
    expect(screen.getAllByText(/GMT\+7 雅加达/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/个余位/)).not.toBeInTheDocument();
    expect(firstCard?.querySelector(".operator-session-room")).toHaveTextContent(upcoming[0].roomLabel);
    expect(screen.queryByText("口语 · 大班互动")).not.toBeInTheDocument();
    expect(screen.queryByText("Halo! Apa kabar?")).not.toBeInTheDocument();
    const rosterSize = upcoming[0].roster?.length ?? 0;
    const classCountTexts = Array.from(container.querySelectorAll(".operator-session-count"))
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim());
    expect(classCountTexts.some((text) => text?.includes(`应到 ${rosterSize} 人`))).toBe(true);
    const sessionBodies = Array.from(container.querySelectorAll(".operator-session-main"));
    expect(sessionBodies.length).toBeGreaterThan(0);
    expect(
      sessionBodies.every(
        (body) =>
          !body.textContent?.includes("已约") &&
          !body.textContent?.includes("候补") &&
          !body.textContent?.includes("已满")
      )
    ).toBe(true);

    fireEvent.click(historyTab);
    await waitFor(() => expect(screen.getByText(history[0].title)).toBeInTheDocument());
    expect(screen.getByText(history[0].title).closest(".operator-session-card"))
      .toHaveTextContent(expectedStatusLabel(history[0], now));
    expect(screen.queryByText(upcoming[0].title)).not.toBeInTheDocument();

    fireEvent.click(allTab);
    expect(screen.getByText(history[0].title)).toBeInTheDocument();
    expect(screen.getByText(upcoming[0].title)).toBeInTheDocument();
  });

  it("filters single sessions by school, class, teacher and date", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    const { container } = render(<App />);

    const state = platform.getState();
    const singleSessions = state.sessions.filter((session) => session.source === "single");
    const target = [...singleSessions].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )[0]!;
    const schoolTimeZone = state.schools.find((school) => school.id === target.schoolId)?.timeZone
      ?? state.ui.timeZone;
    const targetDate = dateKeyInTimeZone(target.startAt, schoolTimeZone);
    const expected = singleSessions.filter(
      (session) =>
        session.schoolId === target.schoolId &&
        session.classId === target.classId &&
        session.teacherId === target.teacherId &&
        dateKeyInTimeZone(session.startAt, schoolTimeZone) === targetDate
    );
    expect(expected.length).toBeGreaterThan(0);

    await screen.findByRole("tab", { name: /即将开始/ });
    expect(screen.queryByLabelText("按学校筛选")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    expect(screen.getByText("日期（学校当地）")).toBeInTheDocument();
    expect(screen.getByText("按学校当地日期匹配，不随查看者时区变化。")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("按学校筛选"), { target: { value: target.schoolId } });

    const classSelect = screen.getByLabelText("按班级筛选") as HTMLSelectElement;
    const schoolClassIds = new Set(
      state.classes.filter((classItem) => classItem.schoolId === target.schoolId).map((classItem) => classItem.id)
    );
    expect(
      Array.from(classSelect.options).every(
        (option) => option.value === "all" || schoolClassIds.has(option.value)
      )
    ).toBe(true);

    fireEvent.change(classSelect, { target: { value: target.classId } });
    fireEvent.change(screen.getByLabelText("按教师筛选"), { target: { value: target.teacherId } });
    fireEvent.change(screen.getByLabelText("按日期筛选"), { target: { value: targetDate } });
    fireEvent.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /^全部/ })).toHaveAttribute("aria-selected", "true")
    );
    expect(container.querySelectorAll(".operator-session-card")).toHaveLength(expected.length);
    expect(screen.getByText(`筛选后 ${expected.length} / 共 ${singleSessions.length} 个课次`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    await waitFor(() =>
      expect(container.querySelectorAll(".operator-session-card")).toHaveLength(singleSessions.length)
    );
  });

  it("only offers reschedule and cancel actions for sessions that can still change", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    const state = platform.getState();
    const now = Date.now();
    const upcoming = state.sessions.find(
      (session) => session.source === "single" && session.status !== "cancelled" && new Date(session.startAt).getTime() > now
    );
    const historical = state.sessions.find(
      (session) => session.source === "single" && (session.status === "cancelled" || new Date(session.endAt).getTime() < now)
    );
    expect(upcoming).toBeDefined();
    expect(historical).toBeDefined();

    await screen.findByRole("tab", { name: /即将开始/ });
    const upcomingCard = screen.getByRole("heading", { level: 3, name: upcoming!.title }).closest(".operator-session-card");
    expect(upcomingCard).not.toBeNull();
    expect(within(upcomingCard as HTMLElement).getByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(within(upcomingCard as HTMLElement).getByRole("button", { name: "名单" })).toBeInTheDocument();
    expect(within(upcomingCard as HTMLElement).getByRole("button", { name: "取消" })).toBeInTheDocument();
    expect(within(upcomingCard as HTMLElement).queryByRole("button", { name: "详情" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /历史课程/ }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 3, name: historical!.title })).toBeInTheDocument());
    const historicalCard = screen.getByRole("heading", { level: 3, name: historical!.title }).closest(".operator-session-card");
    expect(historicalCard).not.toBeNull();
    expect(within(historicalCard as HTMLElement).queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(within(historicalCard as HTMLElement).queryByRole("button", { name: "取消" })).not.toBeInTheDocument();
    expect(within(historicalCard as HTMLElement).getByRole("button", { name: "详情" })).toBeInTheDocument();
    expect(within(historicalCard as HTMLElement).getByRole("button", { name: "名单" })).toBeInTheDocument();
  });

  it("cancels a session without requiring a reason", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    const now = Date.now();
    const session = platform.getState().sessions.find(
      (item) => item.source === "single" && item.status !== "cancelled" && new Date(item.startAt).getTime() > now
    );
    expect(session).toBeDefined();

    await screen.findByRole("tab", { name: /即将开始/ });
    const card = screen.getByRole("heading", { level: 3, name: session!.title }).closest(".operator-session-card");
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "取消" }));

    const dialog = await screen.findByRole("dialog", { name: "取消课次" });
    expect(within(dialog).getByText("取消原因仅用于内部记录，不会展示给学生。")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("例如：教师临时调整（仅内部记录）")).toHaveValue("");
    const confirm = within(dialog).getByRole("button", { name: "确定取消" });
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "取消课次" })).not.toBeInTheDocument());
    expect(platform.getState().sessions.find((item) => item.id === session!.id)?.status).toBe("cancelled");
  });

  it("opens the shared form with session values and saves a changed start time", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    const now = Date.now();
    const session = platform.getState().sessions.find(
      (item) => item.source === "single" && item.status !== "cancelled" && new Date(item.startAt).getTime() > now
    );
    expect(session).toBeDefined();

    await screen.findByRole("tab", { name: /即将开始/ });
    const card = screen.getByRole("heading", { level: 3, name: session!.title }).closest(".operator-session-card");
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "编辑" }));

    const dialog = await screen.findByRole("dialog", { name: "编辑课次" });
    const titleInput = within(dialog).getByPlaceholderText("留空则按课节名自动生成") as HTMLInputElement;
    expect(titleInput.value).toBe(session!.title);
    expect((within(dialog).getByRole("combobox", { name: /^班级/ }) as HTMLSelectElement).value).toBe(session!.classId);
    expect((within(dialog).getByRole("combobox", { name: /^授课教师/ }) as HTMLSelectElement).value).toBe(session!.teacherId);
    expect((within(dialog).getByLabelText("教室（选填）") as HTMLInputElement).value).toBe(session!.roomLabel);
    expect(within(dialog).getByText("保存时会重新校验班级与教师时间冲突，并通知已预约学生")).toBeInTheDocument();

    const nextStart = new Date(now + 100 * 24 * 60 * 60 * 1000);
    nextStart.setHours(3, 7, 0, 0);
    fireEvent.change(within(dialog).getByLabelText("开始时间"), { target: { value: dateTimeLocalValue(nextStart) } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑课次" })).not.toBeInTheDocument());
    const updated = platform.getState().sessions.find((item) => item.id === session!.id);
    expect(updated).toBeDefined();
    expect(new Date(updated!.startAt).getTime()).toBe(nextStart.getTime());
  });

  it("starts a new session from the current school filter instead of stale edit values", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    const state = platform.getState();
    const filteredSchool = state.schools.find(
      (school) =>
        school.status === "active" &&
        state.classes.some((classItem) => classItem.status === "active" && classItem.schoolId === school.id)
    );
    expect(filteredSchool).toBeDefined();
    const expectedClass = state.classes.find(
      (classItem) => classItem.status === "active" && classItem.schoolId === filteredSchool!.id
    );

    await screen.findByRole("tab", { name: /即将开始/ });
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    fireEvent.change(screen.getByLabelText("按学校筛选"), { target: { value: filteredSchool!.id } });
    fireEvent.click(screen.getByRole("button", { name: "完成" }));
    fireEvent.click(screen.getByRole("button", { name: "排课" }));

    const dialog = await screen.findByRole("dialog", { name: "排课" });
    expect((within(dialog).getByRole("combobox", { name: /^所属学校/ }) as HTMLSelectElement).value)
      .toBe(filteredSchool!.id);
    expect((within(dialog).getByRole("combobox", { name: /^班级/ }) as HTMLSelectElement).value)
      .toBe(expectedClass?.id ?? "");
    expect((within(dialog).getByPlaceholderText("留空则按课节名自动生成") as HTMLInputElement).value).toBe("");
  });

  it("does not carry an edited session into the next create form", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    const session = platform.getState().sessions.find(
      (item) => item.source === "single" && item.status !== "cancelled" && new Date(item.startAt).getTime() > Date.now()
    );
    expect(session).toBeDefined();

    await screen.findByRole("tab", { name: /即将开始/ });
    const card = screen.getByRole("heading", { level: 3, name: session!.title }).closest(".operator-session-card");
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "编辑" }));

    const editDialog = await screen.findByRole("dialog", { name: "编辑课次" });
    const titleInput = within(editDialog).getByPlaceholderText("留空则按课节名自动生成");
    fireEvent.change(titleInput, { target: { value: "上一次编辑的残留标题" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: "编辑课次" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "排课" }));
    const createDialog = await screen.findByRole("dialog", { name: "排课" });
    expect((within(createDialog).getByPlaceholderText("留空则按课节名自动生成") as HTMLInputElement).value).toBe("");
  });

  it("switches to all sessions while searching from upcoming and restores the tab after clearing", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    const state = platform.getState();
    const now = Date.now();
    const historical = state.sessions.find(
      (session) => session.source === "single" && (session.status === "cancelled" || new Date(session.endAt).getTime() < now)
    );
    expect(historical).toBeDefined();

    expect(await screen.findByRole("tab", { name: /即将开始/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByPlaceholderText("搜索课次、班级、教师或课节"), {
      target: { value: historical!.title }
    });

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /^全部/ })).toHaveAttribute("aria-selected", "true")
    );
    expect(screen.getByRole("heading", { level: 3, name: historical!.title })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /即将开始/ })).toHaveAttribute("aria-selected", "true")
    );
    expect(screen.queryByRole("heading", { level: 3, name: historical!.title })).not.toBeInTheDocument();
  });

  it("opens a read-only detail for historical sessions", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    const now = Date.now();
    const historical = platform.getState().sessions.find(
      (session) => session.source === "single" && (session.status === "cancelled" || new Date(session.endAt).getTime() < now)
    );
    expect(historical).toBeDefined();

    fireEvent.click(await screen.findByRole("tab", { name: /历史课程/ }));
    const card = await screen.findByRole("heading", { level: 3, name: historical!.title });
    fireEvent.click(within(card.closest(".operator-session-card") as HTMLElement).getByRole("button", { name: "详情" }));

    const dialog = await screen.findByRole("dialog", { name: "课次详情" });
    const titleInput = within(dialog).getByPlaceholderText("留空则按课节名自动生成") as HTMLInputElement;
    expect(titleInput.value).toBe(historical!.title);
    expect(titleInput).toHaveAttribute("readonly");
    expect(within(dialog).getByRole("combobox", { name: /^班级/ })).toBeDisabled();
    expect(within(dialog).getByLabelText("开始时间")).toHaveAttribute("readonly");
    expect(within(dialog).getByLabelText("教室（选填）")).toHaveAttribute("readonly");
    expect(within(dialog).getByText("历史课次仅供查看，不可修改。")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "保存修改" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "确认排课" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭详情" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "课次详情" })).not.toBeInTheDocument());
  });

  it("opens the scheduling reschedule form from a session detail page", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    const session = platform.getState().sessions.find(
      (item) => item.source === "single" && item.status !== "cancelled" && new Date(item.startAt).getTime() > Date.now()
    );
    expect(session).toBeDefined();
    window.location.hash = `#/operator/sessions/${session!.id}`;
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "编辑课次" }));
    expect(await screen.findByRole("dialog", { name: "编辑课次" })).toBeInTheDocument();
    expect((screen.getByPlaceholderText("留空则按课节名自动生成") as HTMLInputElement).value).toBe(session!.title);
  });

  it("opens the session roster in a modal and previews a class roster sync", async () => {
    platform.setCurrentUser("operator-ray");
    const before = platform.getState();
    const now = Date.now();
    const target = before.sessions.find((session) => {
      if (session.source !== "single" || session.status === "cancelled" || new Date(session.startAt).getTime() <= now) return false;
      const members = new Set(
        before.classEnrollments
          .filter((item) => item.classId === session.classId && item.status === "active")
          .map((item) => item.studentId)
      );
      return before.schoolMemberships.some(
        (membership) =>
          membership.schoolId === session.schoolId &&
          membership.role === "student" &&
          membership.status === "active" &&
          !members.has(membership.userId)
      );
    });
    expect(target).toBeDefined();
    const memberIds = new Set(
      before.classEnrollments
        .filter((item) => item.classId === target!.classId && item.status === "active")
        .map((item) => item.studentId)
    );
    const newMember = before.users.find((user) =>
      before.schoolMemberships.some(
        (membership) =>
          membership.schoolId === target!.schoolId &&
          membership.role === "student" &&
          membership.status === "active" &&
          membership.userId === user.id
      ) && !memberIds.has(user.id)
    );
    expect(newMember).toBeDefined();
    expect(platform.addClassMembers({ classId: target!.classId, studentIds: [newMember!.id], actorId: "operator-ray" }).ok).toBe(true);
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    await screen.findByRole("tab", { name: /即将开始/ });
    const card = screen.getByRole("heading", { level: 3, name: target!.title }).closest(".operator-session-card");
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "名单" }));

    const dialog = await screen.findByRole("dialog", { name: new RegExp(`课次名单 · ${target!.title}`) });
    expect(within(dialog).queryByText(newMember!.name)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /同步名单/ }));
    expect(within(dialog).getByText("新增 1 人")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认同步" }));

    await waitFor(() => expect(within(dialog).getByText(newMember!.name)).toBeInTheDocument());
    expect(platform.getState().sessions.find((item) => item.id === target!.id)?.roster).toHaveLength((target!.roster?.length ?? 0) + 1);
  });
});
