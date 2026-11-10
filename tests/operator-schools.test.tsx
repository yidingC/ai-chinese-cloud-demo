import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

async function openSchools() {
  platform.setCurrentUser("operator-ray");
  refreshAppStore();
  window.location.hash = "#/operator/schools";
  render(<App />);
  await screen.findByRole("heading", { level: 1, name: "学校与教职工" });
  return platform.getState();
}

function schoolCard(name: string) {
  const heading = screen.getByRole("heading", { name });
  const card = heading.closest(".school-management-card");
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

function visibleSchoolNames() {
  return Array.from(document.querySelectorAll(".school-card-head h2")).map((node) => node.textContent);
}

describe("operator school staff workspace", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("keeps school metrics to staff and active classes without grade rules", async () => {
    const state = await openSchools();

    expect(within(screen.getByRole("navigation")).getByRole("link", { name: "学校与教职工" })).toBeInTheDocument();
    const toolbar = document.querySelector(".school-directory-toolbar") as HTMLElement;
    expect(toolbar).not.toBeNull();
    expect(within(toolbar).getByRole("button", { name: /新建学校/ })).toBeInTheDocument();
    expect(screen.queryByText("平台默认成绩规则")).not.toBeInTheDocument();
    expect(screen.queryByText(/成绩规则/)).not.toBeInTheDocument();

    const school = state.schools.find((item) => item.name === "印尼圣心学校")!;
    const staff = state.schoolMemberships.filter(
      (item) =>
        item.schoolId === school.id
        && item.status === "active"
        && (item.role === "academic" || item.role === "teacher")
    );
    const academicCount = staff.filter((item) => item.role === "academic").length;
    const teacherCount = staff.filter((item) => item.role === "teacher").length;
    const classCount = state.classes.filter((item) => item.schoolId === school.id && item.status === "active").length;

    const card = schoolCard(school.name);
    const metrics = card.querySelector(".school-card-facts") as HTMLElement;
    expect(metrics).not.toBeNull();
    expect(card.querySelector(".school-card-status")).toBeNull();
    expect(Array.from(metrics.children).map((node) => node.textContent?.replace(/\s+/g, ""))).toEqual([
      `${academicCount}教务`,
      `${teacherCount}教师`,
      `${classCount}进行中班级`
    ]);
    expect(metrics).not.toHaveTextContent("学生");
    expect(screen.getByRole("combobox", { name: "学校状态" })).toHaveTextContent("启用中");
    expect(screen.getByRole("combobox", { name: "学校状态" })).toHaveTextContent("已停用");
  });

  it("links to school-scoped classes without exposing scheduling and provides a way back", async () => {
    const state = await openSchools();
    const school = state.schools.find((item) => item.name === "印尼圣心学校")!;
    const card = schoolCard(school.name);

    expect(within(card).queryByRole("button", { name: /排课/ })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /查看班级/ }));

    await waitFor(() => {
      expect(window.location.hash).toBe(`#/operator/students?school=${school.id}&from=schools`);
    });
    expect(await screen.findByRole("heading", { level: 1, name: "班级与学生" })).toBeInTheDocument();
    expect(screen.getByText("印尼圣心学校7年级A班")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /返回学校与教职工/ }));
    await waitFor(() => expect(window.location.hash).toBe("#/operator/schools"));
    expect(await screen.findByRole("heading", { level: 1, name: "学校与教职工" })).toBeInTheDocument();
  });

  it("manages only academic and teacher accounts inside the staff dialog", async () => {
    const state = await openSchools();
    const school = state.schools.find((item) => item.name === "印尼圣心学校")!;
    fireEvent.click(within(schoolCard(school.name)).getByRole("button", { name: /管理教职工/ }));

    const dialog = await screen.findByRole("dialog", { name: new RegExp(`${school.name} · 教职工管理`) });
    expect(within(dialog).getByRole("heading", { name: "教务" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "教师" })).toBeInTheDocument();

    const availableIds = within(dialog)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value)
      .filter(Boolean);
    expect(availableIds.length).toBeGreaterThan(0);
    expect(availableIds.every((id) => {
      const user = state.users.find((item) => item.id === id);
      return Boolean(user && (user.role === "academic" || user.role === "teacher"));
    })).toBe(true);

    const studentNames = state.schoolMemberships
      .filter((item) => item.schoolId === school.id && item.status === "active" && item.role === "student")
      .map((item) => state.users.find((user) => user.id === item.userId)?.name)
      .filter((name): name is string => Boolean(name));
    expect(studentNames.length).toBeGreaterThan(0);
    studentNames.forEach((name) => expect(within(dialog).queryByText(name, { exact: true })).not.toBeInTheDocument());

    expect(within(dialog).queryByText("学生", { exact: true })).not.toBeInTheDocument();
  });

  it("filters the school directory by name, code, and status", async () => {
    const state = await openSchools();
    const search = screen.getByRole("textbox", { name: "搜索学校" });
    const status = screen.getByRole("combobox", { name: "学校状态" });
    const target = state.schools[1];

    fireEvent.change(search, { target: { value: target.code.toLowerCase() } });
    await waitFor(() => expect(visibleSchoolNames()).toEqual([target.name]));
    expect(document.querySelector(".school-directory-count")).toHaveTextContent(
      /当前\s*1\s*所学校/
    );

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(status, { target: { value: "archived" } });
    const archived = state.schools.filter((item) => item.status === "archived");
    await waitFor(() => expect(visibleSchoolNames()).toEqual(archived.map((item) => item.name)));
    if (archived.length === 0) {
      expect(screen.getByText("没有匹配的学校")).toBeInTheDocument();
    }

    fireEvent.change(status, { target: { value: "all" } });
    await waitFor(() => expect(visibleSchoolNames()).toHaveLength(state.schools.length));
  });

  it("stops a school from the card menu, hides it by default, and lets operators restore it", async () => {
    const state = await openSchools();
    const school = state.schools[1];
    const activeCard = schoolCard(school.name);
    expect(activeCard.querySelector(".school-card-status")).toBeNull();
    fireEvent.click(within(activeCard).getByRole("button", { name: /更多学校操作/ }));
    fireEvent.click(within(activeCard).getByRole("menuitem", { name: "停用学校" }));

    const confirmDialog = await screen.findByRole("dialog", { name: "停用学校" });
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "确认停用" }));
    await waitFor(() => {
      expect(platform.getState().schools.find((item) => item.id === school.id)?.status).toBe("archived");
    });
    expect(visibleSchoolNames()).not.toContain(school.name);

    const status = screen.getByRole("combobox", { name: "学校状态" });
    expect(status).toHaveValue("active");
    fireEvent.change(status, { target: { value: "archived" } });

    await waitFor(() => expect(visibleSchoolNames()).toContain(school.name));
    const card = schoolCard(school.name);
    expect(within(card).getByText("已停用")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /管理教职工/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /查看班级/ })).not.toBeInTheDocument();
    expect(within(card).getByText("停用学校暂不可管理")).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: /更多学校操作/ }));
    fireEvent.click(within(card).getByRole("menuitem", { name: "恢复学校" }));
    await waitFor(() => {
      expect(platform.getState().schools.find((item) => item.id === school.id)?.status).toBe("active");
      expect(visibleSchoolNames()).not.toContain(school.name);
    });

    fireEvent.change(status, { target: { value: "active" } });
    await waitFor(() => expect(visibleSchoolNames()).toContain(school.name));
  });

  it("deletes an empty mistaken school but never offers deletion for a school in use", async () => {
    platform.createSchool({
      name: "误建学校",
      code: "MISTAKE",
      timeZone: "Asia/Jakarta",
      actorId: "operator-ray"
    });
    const state = await openSchools();

    const inUseCard = schoolCard(state.schools[0].name);
    fireEvent.click(within(inUseCard).getByRole("button", { name: /更多学校操作/ }));
    expect(within(inUseCard).queryByRole("menuitem", { name: "删除学校" })).not.toBeInTheDocument();
    fireEvent.click(within(inUseCard).getByRole("button", { name: /更多学校操作/ }));

    const emptyCard = schoolCard("误建学校");
    fireEvent.click(within(emptyCard).getByRole("button", { name: /更多学校操作/ }));
    fireEvent.click(within(emptyCard).getByRole("menuitem", { name: "删除学校" }));
    const dialog = await screen.findByRole("dialog", { name: "删除学校" });
    expect(within(dialog).getByText(/删除后不可恢复/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "永久删除" }));

    await waitFor(() => {
      expect(platform.getState().schools.some((item) => item.name === "误建学校")).toBe(false);
    });
    expect(visibleSchoolNames()).not.toContain("误建学校");
  });

  it("sets a school timezone when creating a school and shows it on the card", async () => {
    await openSchools();
    fireEvent.click(screen.getByRole("button", { name: /新建学校/ }));

    const dialog = await screen.findByRole("dialog", { name: "新建学校" });
    expect(within(dialog).queryByLabelText("状态")).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("学校名称"), { target: { value: "泗水实验学校" } });
    fireEvent.change(within(dialog).getByLabelText("学校编码"), { target: { value: "SURABAYA" } });
    fireEvent.change(within(dialog).getByLabelText("学校时区"), { target: { value: "Asia/Singapore" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存学校" }));

    await waitFor(() => {
      const created = platform.getState().schools.find((item) => item.name === "泗水实验学校");
      expect(created?.timeZone).toBe("Asia/Singapore");
    });
    const card = schoolCard("泗水实验学校");
    expect(within(card).getByText("SURABAYA · GMT+8 新加坡")).toBeInTheDocument();
  });

  it("creates an academic account directly from the staff dialog", async () => {
    const state = await openSchools();
    const school = state.schools.find((item) => item.name === "印尼圣心学校")!;
    fireEvent.click(within(schoolCard(school.name)).getByRole("button", { name: /管理教职工/ }));

    const dialog = await screen.findByRole("dialog", { name: new RegExp(`${school.name} · 教职工管理`) });
    fireEvent.click(within(dialog).getByRole("button", { name: /添加成员/ }));
    const createDrawer = await screen.findByRole("dialog", { name: "添加教职工" });
    expect(createDrawer).toHaveClass("school-staff-drawer-panel");
    expect(createDrawer.closest(".modal-backdrop")).toHaveClass("modal-backdrop-side");
    expect(within(createDrawer).getByText(school.name)).toBeInTheDocument();

    fireEvent.click(within(createDrawer).getByRole("button", { name: "教务" }));
    fireEvent.change(within(createDrawer).getByLabelText("手机号"), { target: { value: "812 3456 9900" } });
    fireEvent.change(within(createDrawer).getByLabelText("姓名"), { target: { value: "Rina 教务" } });
    fireEvent.change(within(createDrawer).getByLabelText("备注"), { target: { value: "负责七八年级教学协调" } });
    fireEvent.click(within(createDrawer).getByRole("button", { name: "创建并加入" }));

    await waitFor(() => {
      const created = platform.getState().users.find((item) => item.name === "Rina 教务");
      expect(created).toMatchObject({ role: "academic", phone: "+62 812 3456 9900" });
      expect(platform.getState().schoolMemberships).toContainEqual(expect.objectContaining({
        schoolId: school.id,
        userId: created!.id,
        role: "academic",
        status: "active"
      }));
    });
    expect(within(dialog).getByText("Rina 教务")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "添加教职工" })).not.toBeInTheDocument());
  });

  it("blocks removing a teacher who is still assigned to an active class", async () => {
    const state = await openSchools();
    const school = state.schools.find((item) => item.name === "印尼圣心学校")!;
    const membership = state.schoolMemberships.find(
      (item) =>
        item.schoolId === school.id
        && item.status === "active"
        && item.role === "teacher"
        && state.classes.some(
          (classGroup) =>
            classGroup.schoolId === school.id
            && classGroup.teacherId === item.userId
            && classGroup.status === "active"
        )
    )!;
    const teacher = state.users.find((item) => item.id === membership.userId)!;
    const relatedClassCount = state.classes.filter(
      (item) => item.schoolId === school.id && item.teacherId === teacher.id && item.status === "active"
    ).length;

    fireEvent.click(within(schoolCard(school.name)).getByRole("button", { name: /管理教职工/ }));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(`${school.name} · 教职工管理`) });
    const row = within(dialog).getByText(teacher.name).closest(".school-member-row") as HTMLElement;
    expect(row).not.toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: /移出/ }));
    expect(within(dialog).getByText(`暂时不能移出 ${teacher.name}`)).toBeInTheDocument();
    expect(within(dialog).getByText(new RegExp(`该教师仍关联 ${relatedClassCount} 个进行中班级`))).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "确认移出" })).not.toBeInTheDocument();
    expect(platform.getState().schoolMemberships.find((item) => item.id === membership.id)?.status).toBe("active");

    fireEvent.click(within(dialog).getByRole("button", { name: "知道了" }));
    expect(within(dialog).queryByText(`暂时不能移出 ${teacher.name}`)).not.toBeInTheDocument();
    expect(platform.getState().schoolMemberships.find((item) => item.id === membership.id)?.status).toBe("active");

    const directRemoval = platform.saveSchoolMembership({
      schoolId: school.id,
      userId: teacher.id,
      role: "teacher",
      status: "left",
      actorId: "operator-ray"
    });
    expect(directRemoval.ok).toBe(false);
    expect(directRemoval.code).toBe("TEACHER_HAS_CLASSES");
  });
});
