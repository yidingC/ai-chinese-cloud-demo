import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

describe("operator student workspace", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("uses the selected school as the class and student context", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/students";
    render(<App />);

    const schoolSelect = await screen.findByRole("combobox", { name: "学校范围" });
    expect(screen.getByText("印尼圣心学校7年级A班")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /返回学校与教职工/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /学生档案/ }));
    expect((await screen.findAllByRole("button", { name: /查看完整档案/ })).length).toBeGreaterThan(0);
    expect(screen.queryByText("待上课程")).not.toBeInTheDocument();
    expect(screen.queryByText("活跃")).not.toBeInTheDocument();
    expect(screen.queryByText("完成互动")).not.toBeInTheDocument();
    expect(screen.queryByText("互动均分")).not.toBeInTheDocument();

    fireEvent.change(schoolSelect, { target: { value: "school-hope" } });

    await waitFor(() => expect(screen.queryByText("印尼圣心学校7年级A班")).not.toBeInTheDocument());
    expect(screen.getByText("印尼希望学校7年级体验班")).toBeInTheDocument();
  });

  it("aggregates all schools and lets a new class choose its school", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/students";
    render(<App />);

    const schoolSelect = await screen.findByRole("combobox", { name: "学校范围" });
    fireEvent.change(schoolSelect, { target: { value: "all" } });

    const hopeClass = await screen.findByText("印尼希望学校7年级体验班");
    expect(screen.getByText("印尼圣心学校7年级A班")).toBeInTheDocument();

    const hopeRow = hopeClass.closest("article");
    expect(hopeRow).not.toBeNull();
    fireEvent.click(within(hopeRow!).getByRole("button", { name: /管理学生/ }));
    expect(await screen.findByRole("dialog", { name: /学生名单 · 印尼希望学校7年级体验班/ })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /关闭/ }));

    fireEvent.click(screen.getByRole("button", { name: /新建班级/ }));
    const dialog = await screen.findByRole("dialog", { name: "新建班级" });
    const classSchool = within(dialog).getByRole("combobox", { name: "所属学校" });
    expect(classSchool).toHaveValue("");

    fireEvent.change(classSchool, { target: { value: "school-hope" } });
    expect(within(dialog).queryByRole("combobox", { name: "教师" })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "班级名称" }), { target: { value: "跨校测试班" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存班级" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "新建班级" })).not.toBeInTheDocument());
    const created = platform.getState().classes.find((item) => item.name === "跨校测试班");
    expect(created?.schoolId).toBe("school-hope");
    expect(created?.teacherId).toBe("");
    const createdRow = screen.getByText("跨校测试班").closest("article");
    expect(createdRow).not.toBeNull();
    expect(within(createdRow!).getByText("印尼希望学校")).toBeInTheDocument();
    expect(within(createdRow!).getByText("未分配教师")).toBeInTheDocument();
  });

  it("shows only the current class roster and can add another same-school student", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/students";
    render(<App />);

    const className = "印尼圣心学校7年级A班";
    const classTitle = await screen.findByText(className);
    const classRow = classTitle.closest("article");
    expect(classRow).not.toBeNull();
    fireEvent.click(within(classRow!).getByRole("button", { name: /管理学生/ }));

    let dialog = await screen.findByRole("dialog");
    const before = platform.getState();
    const classItem = before.classes.find((item) => item.name === className)!;
    const memberIds = new Set(
      before.classEnrollments
        .filter((item) => item.classId === classItem.id && item.status === "active")
        .map((item) => item.studentId)
    );
    const memberName = before.users.find((user) => memberIds.has(user.id))!.name;
    const candidate = before.users.find((user) => {
      if (user.role !== "student" || memberIds.has(user.id)) return false;
      if (!before.students.some((profile) => profile.userId === user.id)) return false;
      return before.schoolMemberships.some((membership) =>
        membership.schoolId === classItem.schoolId
        && membership.userId === user.id
        && membership.role === "student"
        && membership.status === "active"
      );
    })!;
    const outsideMember = before.users.find((user) => {
      if (user.role !== "student" || memberIds.has(user.id)) return false;
      return before.classEnrollments.some((enrollment) =>
        enrollment.studentId === user.id
        && enrollment.status === "active"
        && enrollment.classId !== classItem.id
      );
    })!;

    expect(within(dialog).getByText(memberName)).toBeInTheDocument();
    expect(within(dialog).queryByText(outsideMember.name)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /添加学生/ }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(memberName)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByText(candidate.name));
    fireEvent.click(within(dialog).getByRole("button", { name: "加入 1 名学生" }));

    await waitFor(() => expect(screen.getByRole("dialog", { name: new RegExp(`学生名单 · ${className}`) })).toBeInTheDocument());
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(candidate.name)).toBeInTheDocument();
  });

  it("shows an operations-only student profile with course history and a back action", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/students/student-nadia";
    render(<App />);

    expect(await screen.findByRole("button", { name: /返回学生列表/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "课程记录" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("平均得分")).not.toBeInTheDocument();
    expect(screen.queryByText("练习时长")).not.toBeInTheDocument();
    expect(screen.queryByText("活跃", { exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByText("待上课").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已结束").length).toBeGreaterThan(0);
    expect(screen.queryByText("已结束课程")).not.toBeInTheDocument();
    expect(screen.queryByText("App 绑定")).not.toBeInTheDocument();
    expect(screen.getByText("电话号码")).toBeInTheDocument();
    expect(screen.getByText("时区")).toBeInTheDocument();
    expect(screen.getByText("GMT+7 雅加达")).toBeInTheDocument();
    expect(screen.getByText("所在班级")).toBeInTheDocument();
    expect(screen.queryByText("在读班级")).not.toBeInTheDocument();
    expect(screen.queryByText("加入时间")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /去代约课程/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("嗨！你好！").length).toBeGreaterThan(0);
    expect(screen.getAllByText("问候与时间").length).toBeGreaterThan(0);
    expect(screen.queryByText("问候口语大班课")).not.toBeInTheDocument();
    expect(screen.queryByText("问候复习课")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /编辑档案/ }));
    const editDialog = await screen.findByRole("dialog", { name: "编辑学生档案" });
    const nameInput = within(editDialog).getByRole("textbox", { name: "姓名" });
    const timeZoneSelect = within(editDialog).getByRole("combobox", { name: "时区" });
    expect(nameInput).toHaveValue("Nadia Putri");
    expect(timeZoneSelect).toHaveValue("Asia/Jakarta");
    expect(within(editDialog).queryByText("学习目标")).not.toBeInTheDocument();
    fireEvent.change(nameInput, { target: { value: "Nadia Putri Updated" } });
    fireEvent.change(timeZoneSelect, { target: { value: "Asia/Shanghai" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: /保存档案/ }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑学生档案" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Nadia Putri Updated", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("GMT+8 上海").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /返回学生列表/ }));
    await waitFor(() => expect(window.location.hash).toBe("#/operator/students?tab=students"));
    expect(screen.getByRole("tab", { name: /学生档案/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /新建学生/ })).toBeInTheDocument();
  });
});
