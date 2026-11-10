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

function sessionTitleFor(
  lessons: Array<{ id: string; title: string }>,
  session: { lessonId: string; title: string }
) {
  return lessons.find((lesson) => lesson.id === session.lessonId)?.title ?? session.title;
}

function cardFor(sessionId: string) {
  return document.querySelector<HTMLElement>(
    `.operator-session-card[data-session-id="${sessionId}"]`
  );
}

describe("operator scheduling", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("splits sessions into upcoming and history by end time", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    const { container } = render(<App />);

    const state = platform.getState();
    const now = Date.now();
    const scheduledSessions = state.sessions;
    const upcoming = scheduledSessions
      .filter((session) => session.status !== "cancelled" && new Date(session.endAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    const history = scheduledSessions
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
    const firstCard = cardFor(upcoming[0].id);
    expect(firstCard).not.toBeNull();
    expect(
      within(firstCard as HTMLElement).getByRole("heading", {
        level: 3,
        name: sessionTitleFor(state.lessons, upcoming[0])
      })
    ).toBeInTheDocument();
    expect(cardFor(history[0].id)).toBeNull();
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
    await waitFor(() => expect(cardFor(history[0].id)).not.toBeNull());
    expect(cardFor(history[0].id)).toHaveTextContent(expectedStatusLabel(history[0], now));
    expect(cardFor(upcoming[0].id)).toBeNull();

    fireEvent.click(allTab);
    expect(cardFor(history[0].id)).not.toBeNull();
    expect(cardFor(upcoming[0].id)).not.toBeNull();
  });

  it("filters sessions by school, class, teacher and date", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    const { container } = render(<App />);

    const state = platform.getState();
    const scheduledSessions = state.sessions;
    const target = [...scheduledSessions].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )[0]!;
    const schoolTimeZone = state.schools.find((school) => school.id === target.schoolId)?.timeZone
      ?? state.ui.timeZone;
    const targetDate = dateKeyInTimeZone(target.startAt, schoolTimeZone);
    const expected = scheduledSessions.filter(
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
    expect(screen.getByText(`筛选后 ${expected.length} / 共 ${scheduledSessions.length} 个课次`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    await waitFor(() =>
      expect(container.querySelectorAll(".operator-session-card")).toHaveLength(scheduledSessions.length)
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
    const upcomingCard = cardFor(upcoming!.id);
    expect(upcomingCard).not.toBeNull();
    expect(within(upcomingCard as HTMLElement).getByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(within(upcomingCard as HTMLElement).getByRole("button", { name: "名单" })).toBeInTheDocument();
    expect(within(upcomingCard as HTMLElement).getByRole("button", { name: "取消" })).toBeInTheDocument();
    expect(within(upcomingCard as HTMLElement).queryByRole("button", { name: "详情" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /历史课程/ }));
    await waitFor(() => expect(cardFor(historical!.id)).not.toBeNull());
    const historicalCard = cardFor(historical!.id);
    expect(historicalCard).not.toBeNull();
    expect(within(historicalCard as HTMLElement).queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(within(historicalCard as HTMLElement).queryByRole("button", { name: "取消" })).not.toBeInTheDocument();
    expect(within(historicalCard as HTMLElement).queryByRole("button", { name: "详情" })).not.toBeInTheDocument();
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
    const card = cardFor(session!.id);
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
    const card = cardFor(session!.id);
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "编辑" }));

    const dialog = await screen.findByRole("dialog", { name: "编辑课次" });
    expect(within(dialog).queryByText("课次标题")).not.toBeInTheDocument();
    expect((within(dialog).getByRole("combobox", { name: /^课节/ }) as HTMLSelectElement).value)
      .toBe(session!.lessonId);
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
    expect(within(dialog).queryByText("课次标题")).not.toBeInTheDocument();
    expect((within(dialog).getByRole("combobox", { name: /^课程/ }) as HTMLSelectElement).value).toBe("");
    expect((within(dialog).getByRole("combobox", { name: /^课节/ }) as HTMLSelectElement).value).toBe("");
    expect(within(dialog).getByRole("button", { name: "确认排课" })).toBeDisabled();
  });

  it("requires choosing a course before a published lesson", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    const state = platform.getState();
    const courses = state.folders.filter(
      (course) =>
        course.status === "published" &&
        state.lessons.some((lesson) => lesson.folderId === course.id && lesson.status === "published")
    );
    expect(courses.length).toBeGreaterThan(1);
    const course = courses[0]!;
    const otherCourse = courses[1]!;
    const publishedLessons = state.lessons.filter(
      (lesson) => lesson.folderId === course.id && lesson.status === "published"
    );
    expect(publishedLessons.length).toBeGreaterThan(0);

    await screen.findByRole("tab", { name: /即将开始/ });
    fireEvent.click(screen.getByRole("button", { name: "排课" }));
    const dialog = await screen.findByRole("dialog", { name: "排课" });
    const courseSelect = within(dialog).getByRole("combobox", { name: /^课程/ }) as HTMLSelectElement;
    const lessonSelect = within(dialog).getByRole("combobox", { name: /^课节/ }) as HTMLSelectElement;
    const confirm = within(dialog).getByRole("button", { name: "确认排课" });

    expect(courseSelect.value).toBe("");
    expect(lessonSelect).toBeDisabled();
    expect(confirm).toBeDisabled();

    fireEvent.change(courseSelect, { target: { value: course.id } });
    expect(lessonSelect).not.toBeDisabled();
    const lessonOptionValues = Array.from(lessonSelect.options)
      .map((option) => option.value)
      .filter(Boolean);
    expect(lessonOptionValues).toEqual(publishedLessons.map((lesson) => lesson.id));
    expect(confirm).toBeDisabled();

    const lesson = publishedLessons[0]!;
    fireEvent.change(lessonSelect, { target: { value: lesson.id } });
    expect(lessonSelect.value).toBe(lesson.id);
    expect(confirm).not.toBeDisabled();
    expect((within(dialog).getByLabelText("单次时长（分钟）") as HTMLInputElement).value)
      .toBe(String(lesson.durationMinutes));

    fireEvent.change(courseSelect, { target: { value: otherCourse.id } });
    expect(lessonSelect.value).toBe("");
    expect(confirm).toBeDisabled();
  });

  it("does not carry an edited session into the next create form", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/scheduling";
    render(<App />);

    const state = platform.getState();
    const session = state.sessions.find(
      (item) => item.source === "single" && item.status !== "cancelled" && new Date(item.startAt).getTime() > Date.now()
    );
    expect(session).toBeDefined();

    await screen.findByRole("tab", { name: /即将开始/ });
    const card = cardFor(session!.id);
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "编辑" }));

    const editDialog = await screen.findByRole("dialog", { name: "编辑课次" });
    expect(within(editDialog).queryByText("课次标题")).not.toBeInTheDocument();
    const sessionCourseId = state.lessons.find((lesson) => lesson.id === session!.lessonId)?.folderId;
    const editedCourse = state.folders.find(
      (folder) => folder.id !== sessionCourseId && folder.status === "published"
    );
    fireEvent.change(within(editDialog).getByRole("combobox", { name: /^课程/ }), {
      target: { value: editedCourse?.id ?? "" }
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: "编辑课次" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "排课" }));
    const createDialog = await screen.findByRole("dialog", { name: "排课" });
    expect(within(createDialog).queryByText("课次标题")).not.toBeInTheDocument();
    expect((within(createDialog).getByRole("combobox", { name: /^课程/ }) as HTMLSelectElement).value).toBe("");
    expect((within(createDialog).getByRole("combobox", { name: /^课节/ }) as HTMLSelectElement).value).toBe("");
    expect(within(createDialog).getByRole("button", { name: "确认排课" })).toBeDisabled();
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
    const historicalTitle = sessionTitleFor(state.lessons, historical!);

    expect(await screen.findByRole("tab", { name: /即将开始/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByPlaceholderText("搜索课次、班级、教师或课节"), {
      target: { value: historicalTitle }
    });

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /^全部/ })).toHaveAttribute("aria-selected", "true")
    );
    const historicalCard = cardFor(historical!.id);
    expect(
      within(historicalCard as HTMLElement).getByRole("heading", { level: 3, name: historicalTitle })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /即将开始/ })).toHaveAttribute("aria-selected", "true")
    );
    expect(cardFor(historical!.id)).toBeNull();
  });

  it("focuses a historical session from a direct schedule link", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    const now = Date.now();
    const historical = platform.getState().sessions.find(
      (session) => session.source === "single" && (session.status === "cancelled" || new Date(session.endAt).getTime() < now)
    );
    expect(historical).toBeDefined();
    window.location.hash = `#/operator/scheduling?focus=${historical!.id}`;
    render(<App />);

    await waitFor(() => {
      expect(document.querySelector(`[data-session-id="${historical!.id}"]`)).toHaveClass("is-focused");
    });
    expect(screen.getByRole("tab", { name: /历史课程/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("dialog", { name: "课次详情" })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe("#/operator/scheduling"));
  });

  it("focuses a series session in the unified schedule list", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    const now = Date.now();
    const seriesSession = platform.getState().sessions.find(
      (session) =>
        session.source === "series" &&
        session.status !== "cancelled" &&
        new Date(session.endAt).getTime() >= now
    );
    expect(seriesSession).toBeDefined();
    window.location.hash = `#/operator/scheduling?focus=${seriesSession!.id}`;
    render(<App />);

    await waitFor(() => {
      expect(document.querySelector(`[data-session-id="${seriesSession!.id}"]`)).toHaveClass("is-focused");
    });
    const seriesCard = cardFor(seriesSession!.id);
    expect(
      within(seriesCard as HTMLElement).getByRole("heading", {
        level: 3,
        name: sessionTitleFor(platform.getState().lessons, seriesSession!)
      })
    ).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe("#/operator/scheduling"));
  });

  it("redirects legacy session links to the focused schedule card", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    const session = platform.getState().sessions.find(
      (item) => item.source === "single" && item.status !== "cancelled" && new Date(item.startAt).getTime() > Date.now()
    );
    expect(session).toBeDefined();
    window.location.hash = `#/operator/sessions/${session!.id}`;
    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe("#/operator/scheduling"));
    await waitFor(() => {
      expect(document.querySelector(`[data-session-id="${session!.id}"]`)).toHaveClass("is-focused");
    });
    expect(screen.queryByRole("dialog", { name: "课次详情" })).not.toBeInTheDocument();
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
    const card = cardFor(target!.id);
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "名单" }));

    const targetTitle = sessionTitleFor(before.lessons, target!);
    const dialog = await screen.findByRole("dialog", { name: `课次名单 · ${targetTitle}` });
    expect(within(dialog).queryByText(newMember!.name)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /同步名单/ }));
    expect(within(dialog).getByText("新增 1 人")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认同步" }));

    await waitFor(() => expect(within(dialog).getByText(newMember!.name)).toBeInTheDocument());
    expect(platform.getState().sessions.find((item) => item.id === target!.id)?.roster).toHaveLength((target!.roster?.length ?? 0) + 1);
  });
});
