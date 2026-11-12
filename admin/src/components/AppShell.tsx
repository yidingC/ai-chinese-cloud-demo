import { Fragment, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ClipboardList,
  Eye,
  EyeOff,
  FolderTree,
  GraduationCap,
  Home,
  LibraryBig,
  Menu,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  X
} from "lucide-react";
import { platform } from "../lib/platform";
import { roleHome, usePlatformStore } from "../store/usePlatformStore";
import { currentUser } from "../lib/domain";
import { setTeacherDemoMode, useTeacherDemoMode } from "../lib/teacherLiveDemo";
import { timeZoneLabel } from "../lib/format";
import type { Role } from "../domain/types";
import { Avatar, Badge, Button, Select } from "./ui";
import { getPmNoteVisibility, PmNote, setPmNoteVisibility } from "./PmNote";

const navIcons = {
  dashboard: Home,
  booking: Sparkles,
  schedule: CalendarDays,
  results: BarChart3,
  grades: GraduationCap,
  materials: LibraryBig,
  interactions: Sparkles,
  catalog: FolderTree,
  scheduling: ClipboardList,
  students: Users,
  schools: Building2,
  governance: ShieldCheck,
  notifications: Bell
};

type SidebarNavItem = {
  to: string;
  end?: boolean;
  key: string;
  label: string;
  group?: string;
};

function navItems(role: Role, t: (key: string) => string): SidebarNavItem[] {
  if (role === "student") {
    return [
      { to: "/student", end: true, key: "dashboard", label: t("nav.dashboard"), group: "dashboard" },
      { to: "/student/schedule", key: "schedule", label: t("nav.schedule"), group: "schedule" },
      { to: "/student/results", key: "results", label: t("nav.academicResults"), group: "results" },
      { to: "/student/grades", key: "grades", label: t("nav.grades"), group: "results" },
      { to: "/notifications", key: "dashboard", label: t("common.notifications"), group: "notifications" }
    ];
  }
  if (role === "teacher") {
    return [
      { to: "/teacher", end: true, key: "dashboard", label: t("nav.dashboard"), group: "dashboard" },
      { to: "/teacher/schedule", key: "schedule", label: t("nav.schedule"), group: "schedule" },
      { to: "/teacher/results", key: "results", label: t("nav.results"), group: "results" },
      { to: "/teacher/grades", key: "grades", label: t("nav.studentGrades"), group: "results" },
      { to: "/teacher/materials", key: "materials", label: t("nav.materials"), group: "library" },
      { to: "/teacher/interactions", key: "interactions", label: t("nav.interactions"), group: "library" },
      { to: "/notifications", key: "dashboard", label: t("common.notifications"), group: "notifications" }
    ];
  }
  if (role === "academic") {
    return [
      { to: "/academic", end: true, key: "dashboard", label: t("nav.dashboard"), group: "dashboard" },
      { to: "/academic/scheduling", key: "scheduling", label: t("nav.academicCalendar"), group: "schedule" },
      { to: "/academic/students", key: "students", label: t("nav.academicStudents"), group: "students" },
      { to: "/academic/results", key: "results", label: t("nav.academicResults"), group: "results" },
      { to: "/academic/grades", key: "grades", label: t("nav.studentGrades"), group: "results" },
      { to: "/notifications", key: "dashboard", label: t("common.notifications"), group: "notifications" }
    ];
  }
  return [
    { to: "/operator", end: true, key: "dashboard", label: t("nav.dashboard"), group: "dashboard" },
    { to: "/operator/scheduling", key: "scheduling", label: t("nav.scheduling"), group: "scheduling" },
    { to: "/operator/students", key: "students", label: t("nav.students"), group: "people" },
    { to: "/operator/schools", key: "schools", label: t("nav.schools"), group: "people" },
    { to: "/operator/results", key: "results", label: t("nav.academicResults"), group: "results" },
    { to: "/operator/grades", key: "grades", label: t("nav.studentGrades"), group: "results" },
    { to: "/operator/catalog", key: "catalog", label: t("nav.catalog"), group: "catalog" }
  ];
}

export function AppShell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, refresh, switchUser, reset } = usePlatformStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notesVisible, setNotesVisible] = useState(getPmNoteVisibility);
  const [teacherDemoMode] = useTeacherDemoMode();
  const user = currentUser(state);
  const role = user.role;
  const items = navItems(role, t);
  const unread = state.notifications.filter((notice) => notice.userId === user.id && !notice.read).length;
  // 角色预览把账号按角色分组，学生多的时候也能一眼看清结构。
  const roleOrder: Role[] = ["academic", "operator", "teacher", "student"];
  const userGroups = useMemo(
    () =>
      roleOrder
        .map((role) => ({
          role,
          users: state.users.filter((item) => item.role === role).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
        }))
        .filter((group) => group.users.length > 0),
    [state.users]
  );

  useEffect(() => {
    const unsubscribe = platform.subscribe((nextState) => refresh(nextState));
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setPmNoteVisibility(notesVisible);
  }, [notesVisible]);

  useEffect(() => {
    if (state.ui.language !== i18n.language) void i18n.changeLanguage(state.ui.language);
  }, [i18n, state.ui.language]);

  function changeUser(userId: string) {
    const next = state.users.find((item) => item.id === userId);
    if (!next) return;
    switchUser(userId);
    navigate(roleHome(next.role));
  }

  const usesGroupedSidebar = role === "operator" || role === "teacher" || role === "academic" || role === "student";
  const sidebarGroups = usesGroupedSidebar
    ? items.reduce<Array<{ key: string; items: SidebarNavItem[] }>>((groups, item) => {
        const key = item.group ?? item.to;
        const existing = groups.find((group) => group.key === key);
        if (existing) existing.items.push(item);
        else groups.push({ key, items: [item] });
        return groups;
      }, [])
    : [{ key: "main", items }];

  function renderNavItem(item: SidebarNavItem) {
    const Icon = navIcons[item.key as keyof typeof navIcons] ?? Home;
    const isNotification = item.to === "/notifications";
    const link = (
      <NavLink to={item.to} end={item.end}>
        <Icon size={18} />
        <span>{item.label}</span>
        {isNotification && unread > 0 && <b className="nav-count">{unread}</b>}
      </NavLink>
    );
    const itemKey = `${item.to}-${item.label}`;
    if (role === "teacher" && item.to === "/teacher/schedule") {
      return (
        <PmNote
          key={itemKey}
          block
          kind="注意"
          className="sidebar-nav-note sidebar-nav-note-highlight"
          note="一期最重要的是做课中互动里的「添加互动设计」。保存发布后，学生端会在上课时实时调用。"
        >
          {link}
        </PmNote>
      );
    }
    return <Fragment key={itemKey}>{link}</Fragment>;
  }

  return (
    <div className={`admin-layout ${state.ui.sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">
            <GraduationCap size={22} />
          </span>
          <div>
            <strong>{t("common.appName")}</strong>
            <small>{t("common.adminName")}</small>
          </div>
          {mobileOpen && (
            <Button className="mobile-close" size="icon" variant="ghost" aria-label="关闭导航" onClick={() => setMobileOpen(false)}>
              <X size={18} />
            </Button>
          )}
        </div>

        <div className="role-summary">
          <Avatar label={user.avatar} tone={role === "teacher" ? "orange" : role === "academic" ? "mint" : role === "operator" ? "blue" : "purple"} />
          <div>
            <strong>{user.name}</strong>
            <small>{t(`common.${role}`)}</small>
          </div>
          <Badge tone={role === "teacher" ? "orange" : role === "operator" ? "blue" : role === "academic" ? "mint" : "purple"}>{t(`common.${role}`)}</Badge>
        </div>

        <nav className={`sidebar-nav ${usesGroupedSidebar ? "is-grouped" : ""}`}>
          {sidebarGroups.map((group) => (
            usesGroupedSidebar
              ? <div key={group.key} className="sidebar-nav-group">{group.items.map(renderNavItem)}</div>
              : <Fragment key={group.key}>{group.items.map(renderNavItem)}</Fragment>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="collapse-button"
            onClick={() => {
              platform.updatePreferences({ sidebarCollapsed: !state.ui.sidebarCollapsed });
              refresh();
            }}
          >
            <ChevronLeft size={16} />
            <span>收起侧栏</span>
          </button>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="关闭导航" />}

      <main className="workspace">
        <header className="topbar">
          <Button className="mobile-menu" size="icon" variant="ghost" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </Button>

          <PmNote kind="流程" note="切换身份后重新加载对应工作区，并带上该账号默认的语言与时区。" className="demo-switcher">
            <span className="demo-dot" />
            <Select value={user.id} onChange={(event) => changeUser(event.target.value)} aria-label={t("common.switchRole")}>
              {userGroups.map((group) => (
                <optgroup key={group.role} label={t(`common.${group.role}`)}>
                  {group.users.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </PmNote>

          <div className="topbar-spacer" />

          {role === "teacher" && (
            <PmNote kind="规则" className="teacher-demo-mode" note="课堂视图只决定工作台展示实时态还是空闲态，不会修改真实排课。">
              <div role="group" aria-label="课堂视图">
              <span className="teacher-demo-mode-label">演示数据</span>
              <button className={teacherDemoMode === "live" ? "active live" : ""} onClick={() => setTeacherDemoMode("live")} type="button">
                <Radio size={14} /> 有课
              </button>
              <button className={teacherDemoMode === "empty" ? "active empty" : ""} onClick={() => setTeacherDemoMode("empty")} type="button">
                <CalendarOff size={14} /> 没课
              </button>
              </div>
            </PmNote>
          )}

          <Button
            className={`pm-note-toggle ${notesVisible ? "is-on" : ""}`}
            variant="secondary"
            size="sm"
            aria-pressed={notesVisible}
            title={notesVisible ? "隐藏全部研发标注" : "显示全部研发标注"}
            onClick={() => setNotesVisible((value) => !value)}
          >
            {notesVisible ? <Eye size={15} /> : <EyeOff size={15} />}
            <span className="pm-note-toggle-label">标注：{notesVisible ? "开" : "关"}</span>
          </Button>

          <PmNote kind="规则" note="语言和时区属于查看者偏好。切换后立即影响当前工作区，不改业务数据。">
            <Select
              className="timezone-select"
              value={state.ui.language}
              onChange={(event) => {
                const language = event.target.value as "zh-CN" | "id-ID";
                platform.updatePreferences({ language });
                refresh();
                void i18n.changeLanguage(language);
              }}
              aria-label={t("common.language")}
            >
              <option value="zh-CN">中文</option>
              <option value="id-ID">Bahasa Indonesia</option>
            </Select>
          </PmNote>

          <PmNote kind="口径" className="pm-note-timezone" note="课次仍按统一时间存储，页面只按当前用户时区展示。">
            <button className="timezone-chip" title={t("common.timezone")}>
              {timeZoneLabel(user.timeZone)}
            </button>
          </PmNote>

          {role !== "operator" && (
            <Button size="icon" variant="ghost" className="notification-button" onClick={() => navigate("/notifications")}>
              <Bell size={19} />
              {unread > 0 && <span className="notification-dot">{unread}</span>}
            </Button>
          )}

          <Button
            variant="soft"
            size="sm"
            onClick={() => {
              if (window.confirm("确定重置全部演示数据吗？")) reset();
            }}
          >
            <BookOpenCheck size={16} />
            {t("common.resetDemo")}
          </Button>
        </header>

        <div className="workspace-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
