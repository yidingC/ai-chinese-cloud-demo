import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarClock, CalendarPlus, Filter, GraduationCap, Inbox, Layers3, Search, UsersRound, WandSparkles, X } from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getBookedCount, getLesson, getSchoolTimeZone, getSession } from "../../lib/domain";
import { getAcademicSchoolId, workspaceState } from "../../lib/academicScope";
import { formatDateTime, inputDateTime } from "../../lib/format";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, ProgressBar, Select, Tabs, TextInput } from "../../components/ui";
import { OperatorSessionCard } from "../../components/OperatorSessionCard";
import { OperatorSessionRosterModal } from "../../components/OperatorSessionRosterModal";
import { SeriesSessionDots } from "../../components/SeriesSessionDots";
import type { ClassSession } from "../../domain/types";

type ScheduleTab = "sessions" | "series";
type SessionTimeTab = "upcoming" | "history" | "all";
type CreateMode = "single" | "series" | "edit" | "view" | null;
type SessionForm = {
  title: string;
  schoolId: string;
  classId: string;
  lessonId: string;
  folderId: string;
  lessonIds: string[];
  sessionSchedule: Record<string, string>;
  manualScheduleIds: string[];
  teacherId: string;
  startAt: string;
  durationMinutes: number;
  capacity: number;
  intervalWeeks: number;
  roomLabel: string;
  description: string;
};

/** 按首节课时间与课节间隔预排每一节的日期时间；只做预填，创建前可以逐节调整。 */
function buildAutoSchedule(lessonIds: string[], startAt: string, intervalWeeks: number) {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return {};
  const interval = Math.max(1, Number(intervalWeeks) || 1);
  return lessonIds.reduce<Record<string, string>>((acc, lessonId, index) => {
    const slot = new Date(start.getTime());
    slot.setDate(slot.getDate() + index * 7 * interval);
    acc[lessonId] = inputDateTime(slot);
    return acc;
  }, {});
}

/** 重新自动预排时保留人工改过的课次时间，避免调整全局参数把手工修改冲掉。 */
function mergeAutoSchedule(
  lessonIds: string[],
  startAt: string,
  intervalWeeks: number,
  current: Record<string, string>,
  manualIds: string[]
) {
  const autoSchedule = buildAutoSchedule(lessonIds, startAt, intervalWeeks);
  return lessonIds.reduce<Record<string, string>>((acc, lessonId) => {
    acc[lessonId] = manualIds.includes(lessonId) && current[lessonId] ? current[lessonId] : autoSchedule[lessonId];
    return acc;
  }, {});
}

/** 排课按学校当地时间看日期，跨时区学校不能用浏览器本地日期直接比较。 */
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

export function OperatorScheduling({
  academic = false,
  basePath = "/operator"
}: {
  academic?: boolean;
  basePath?: string;
} = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state: rawState, run } = usePlatformStore();
  const user = currentUser(rawState);
  const state = useMemo(() => (academic ? workspaceState(rawState, getAcademicSchoolId(rawState, user)) : rawState), [academic, rawState, user]);
  const [tab] = useState<ScheduleTab>("sessions");
  const [sessionTimeTab, setSessionTimeTab] = useState<SessionTimeTab>("upcoming");
  const [query, setQuery] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const tabBeforeSearchRef = useRef<SessionTimeTab | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [cancelSessionId, setCancelSessionId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rosterSessionId, setRosterSessionId] = useState<string | null>(null);
  const [scheduleSeriesId, setScheduleSeriesId] = useState<string | null>(null);
  const [seriesTimes, setSeriesTimes] = useState<Record<string, string>>({});
  const requestedSchoolId = academic ? "" : searchParams.get("school") ?? "";
  const initialSchoolId = academic
    ? getAcademicSchoolId(rawState, user)
    : state.schools.find((school) => school.id === requestedSchoolId && school.status === "active")?.id
      ?? state.schools.find((school) =>
        school.status === "active" &&
        state.classes.some((classItem) => classItem.status === "active" && classItem.schoolId === school.id)
      )?.id ?? state.schools.find((school) => school.status === "active")?.id ?? "";
  const initialClass = state.classes.find((item) => item.status === "active" && item.schoolId === initialSchoolId)
    ?? state.classes.find((item) => item.status === "active");

  function buildCreateFormDefaults(): SessionForm {
    const filteredClass = classFilter !== "all"
      ? state.classes.find((item) => item.id === classFilter && item.status === "active")
      : undefined;
    const targetSchoolId = filteredClass?.schoolId ?? (schoolFilter !== "all" ? schoolFilter : initialSchoolId);
    const targetClass = filteredClass
      ?? state.classes.find((item) => item.status === "active" && item.schoolId === targetSchoolId)
      ?? initialClass
      ?? state.classes.find((item) => item.status === "active");
    const firstLesson = state.lessons[0];
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    const teacherId = teacherFilter !== "all"
      ? teacherFilter
      : targetClass?.teacherId ?? state.users.find((item) => item.role === "teacher")?.id ?? "";
    return {
      title: "",
      schoolId: targetClass?.schoolId ?? targetSchoolId,
      classId: targetClass?.id ?? "",
      lessonId: firstLesson?.id ?? "",
      folderId: firstLesson?.folderId ?? state.folders[0]?.id ?? "",
      lessonIds: [],
      sessionSchedule: {},
      manualScheduleIds: [],
      teacherId,
      startAt: inputDateTime(start),
      durationMinutes: 40,
      capacity: 30,
      intervalWeeks: 1,
      roomLabel: "",
      description: ""
    };
  }

  const [form, setForm] = useState<SessionForm>(() => buildCreateFormDefaults());

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    openCreate("single");
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const sessionId = searchParams.get("edit");
    if (!sessionId) return;
    openEditSession(sessionId);
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!filtersOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!filterPopoverRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  const requestKindLabels: Record<string, string> = {
    reschedule: "申请改期",
    add_session: "申请加课",
    new_lesson_plan: "申请新增课节",
    teacher_swap: "申请更换授课老师",
    cancel: "申请取消课次"
  };
  const pendingRequests = state.changeRequests.filter((request) => request.status === "pending");

  const normalizedQuery = query.trim().toLowerCase();
  const sessions = state.sessions
    .filter((session) => {
      if (schoolFilter !== "all" && session.schoolId !== schoolFilter) return false;
      if (classFilter !== "all" && session.classId !== classFilter) return false;
      if (teacherFilter !== "all" && session.teacherId !== teacherFilter) return false;
      if (dateFilter && dateKeyInTimeZone(session.startAt, getSchoolTimeZone(state, session.schoolId)) !== dateFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      const teacher = state.users.find((candidate) => candidate.id === session.teacherId);
      return [session.title, session.className, getLesson(state, session.lessonId)?.title ?? "", teacher?.name ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const filterSchools = state.schools
    .filter((school) => school.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const filterClasses = state.classes
    .filter((item) => item.status === "active" && (schoolFilter === "all" || item.schoolId === schoolFilter))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const filterTeachers = state.users
    .filter(
      (candidate) =>
        candidate.role === "teacher" &&
        (schoolFilter === "all" ||
          state.schoolMemberships.some(
            (membership) =>
              membership.schoolId === schoolFilter &&
              membership.userId === candidate.id &&
              membership.role === "teacher" &&
              membership.status === "active"
          ))
    )
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const hasActiveFilters = Boolean(query.trim() || dateFilter) ||
    schoolFilter !== "all" ||
    classFilter !== "all" ||
    teacherFilter !== "all";
  const activeFilterCount = [
    !academic && schoolFilter !== "all",
    classFilter !== "all",
    teacherFilter !== "all",
    Boolean(dateFilter)
  ].filter(Boolean).length;
  const selectedSchool = schoolFilter !== "all" ? filterSchools.find((school) => school.id === schoolFilter) : undefined;
  const selectedClass = classFilter !== "all" ? filterClasses.find((item) => item.id === classFilter) : undefined;
  const selectedTeacher = teacherFilter !== "all" ? filterTeachers.find((teacher) => teacher.id === teacherFilter) : undefined;

  const themeFolders = state.folders.filter(
    (folder) =>
      folder.status === "published" &&
      state.lessons.filter((lesson) => lesson.folderId === folder.id && lesson.status === "published").length >= 2
  );
  const themeLessons = state.lessons.filter(
    (lesson) => lesson.folderId === form.folderId && lesson.status === "published"
  );
  const activeAvailableClasses = state.classes.filter(
    (item) => item.status === "active" && item.schoolId === form.schoolId
  );
  const currentFormClass = state.classes.find((item) => item.id === form.classId);
  const availableClasses = currentFormClass && !activeAvailableClasses.some((item) => item.id === currentFormClass.id)
    ? [...activeAvailableClasses, currentFormClass]
    : activeAvailableClasses;
  const activeFormTeachers = state.users
    .filter((item) => item.role === "teacher")
    .filter((teacher) =>
      state.schoolMemberships.some(
        (membership) =>
          membership.schoolId === form.schoolId &&
          membership.userId === teacher.id &&
          membership.role === "teacher" &&
          membership.status === "active"
      )
    );
  const currentFormTeacher = state.users.find((item) => item.id === form.teacherId);
  const availableTeachers = currentFormTeacher && !activeFormTeachers.some((item) => item.id === currentFormTeacher.id)
    ? [...activeFormTeachers, currentFormTeacher]
    : activeFormTeachers;
  const singleSessions = sessions.filter((session) => session.source === "single");
  const sessionTimeBoundary = Date.now();
  const upcomingSingleSessions = singleSessions
    .filter((session) => session.status !== "cancelled" && new Date(session.endAt).getTime() >= sessionTimeBoundary)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const historySingleSessions = singleSessions
    .filter((session) => session.status === "cancelled" || new Date(session.endAt).getTime() < sessionTimeBoundary)
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  const visibleSingleSessions = sessionTimeTab === "upcoming"
    ? upcomingSingleSessions
    : sessionTimeTab === "history"
      ? historySingleSessions
      : [...upcomingSingleSessions, ...historySingleSessions];
  const allSingleSessions = state.sessions.filter((session) => session.source === "single");
  const totalUpcomingSessionCount = allSingleSessions
    .filter((session) => session.status !== "cancelled" && new Date(session.endAt).getTime() >= sessionTimeBoundary)
    .length;
  const totalHistorySessionCount = allSingleSessions
    .filter((session) => session.status === "cancelled" || new Date(session.endAt).getTime() < sessionTimeBoundary)
    .length;
  const currentTabSessionCount = sessionTimeTab === "upcoming"
    ? totalUpcomingSessionCount
    : sessionTimeTab === "history"
      ? totalHistorySessionCount
      : allSingleSessions.length;
  const showFilteredCount = hasActiveFilters && visibleSingleSessions.length !== currentTabSessionCount;

  function clearSessionFilters() {
    setSchoolFilter("all");
    setClassFilter("all");
    setTeacherFilter("all");
    setDateFilter("");
  }

  function changeSessionTimeTab(next: SessionTimeTab) {
    setSessionTimeTab(next);
    if (query.trim()) {
      tabBeforeSearchRef.current = next === "all" ? null : next;
    }
  }

  function changeQuery(next: string) {
    const hadQuery = Boolean(query.trim());
    const hasQuery = Boolean(next.trim());
    if (!hadQuery && hasQuery) {
      tabBeforeSearchRef.current = sessionTimeTab === "all" ? null : sessionTimeTab;
      setSessionTimeTab("all");
    } else if (hadQuery && !hasQuery && tabBeforeSearchRef.current) {
      setSessionTimeTab(tabBeforeSearchRef.current);
      tabBeforeSearchRef.current = null;
    }
    setQuery(next);
  }

  function loadSessionForm(sessionId: string) {
    const session = getSession(state, sessionId);
    if (!session) return false;
    const lesson = getLesson(state, session.lessonId);
    const durationMinutes = Math.max(
      1,
      Math.round((new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) / 60_000)
    );
    setEditingSessionId(session.id);
    setForm({
      ...buildCreateFormDefaults(),
      title: session.title,
      schoolId: session.schoolId,
      classId: session.classId,
      lessonId: session.lessonId,
      folderId: lesson?.folderId ?? "",
      teacherId: session.teacherId,
      startAt: inputDateTime(session.startAt),
      durationMinutes,
      capacity: session.capacity,
      roomLabel: session.roomLabel
    });
    return true;
  }

  function openEditSession(sessionId: string) {
    if (loadSessionForm(sessionId)) setCreateMode("edit");
  }

  function openViewSession(sessionId: string) {
    if (loadSessionForm(sessionId)) setCreateMode("view");
  }

  function closeFormModal() {
    setCreateMode(null);
    setEditingSessionId(null);
  }

  function openCancelSession(sessionId: string) {
    setCancelSessionId(sessionId);
    setCancelReason("");
  }

  function confirmSessionCancel() {
    if (!cancelSessionId) return;
    const result = run(
      () =>
        platform.cancelSession({
          sessionId: cancelSessionId,
          actorId: user.id,
          reason: cancelReason.trim()
        }),
      "课堂已取消"
    );
    if (result.ok) {
      setCancelSessionId(null);
      setCancelReason("");
    }
  }

  function canRescheduleSession(session: ClassSession) {
    return session.status !== "cancelled" && new Date(session.startAt).getTime() > Date.now();
  }

  function canCancelSession(session: ClassSession) {
    return session.status !== "cancelled" && new Date(session.endAt).getTime() >= Date.now();
  }

  function openCreate(mode: "single" | "series") {
    const defaults = buildCreateFormDefaults();
    if (mode === "series") {
      const folderId = themeFolders.some((folder) => folder.id === defaults.folderId)
        ? defaults.folderId
        : themeFolders[0]?.id ?? "";
      const defaultLessonIds = state.lessons
        .filter((lesson) => lesson.folderId === folderId && lesson.status === "published")
        .slice(0, 2)
        .map((lesson) => lesson.id);
      setForm({
        ...defaults,
        folderId,
        lessonIds: defaultLessonIds,
        sessionSchedule: buildAutoSchedule(defaultLessonIds, defaults.startAt, defaults.intervalWeeks),
        manualScheduleIds: []
      });
    } else {
      setForm(defaults);
    }
    setEditingSessionId(null);
    setCreateMode(mode);
  }

  function changeSchool(schoolId: string) {
    const nextClass = state.classes.find(
      (item) => item.status === "active" && item.schoolId === schoolId
    );
    setForm((value) => ({
      ...value,
      schoolId,
      classId: nextClass?.id ?? "",
      teacherId: nextClass?.teacherId ?? ""
    }));
  }

  function chooseTheme(folderId: string) {
    setForm((value) => ({ ...value, folderId, lessonIds: [], sessionSchedule: {}, manualScheduleIds: [] }));
  }

  function toggleSeriesLesson(lessonId: string) {
    setForm((value) => {
      const orderedIds = state.lessons
        .filter((lesson) => lesson.folderId === value.folderId && lesson.status === "published")
        .map((lesson) => lesson.id);
      const lessonIds = value.lessonIds.includes(lessonId)
        ? value.lessonIds.filter((id) => id !== lessonId)
        : orderedIds.filter((id) => value.lessonIds.includes(id) || id === lessonId);
      const autoSchedule = buildAutoSchedule(lessonIds, value.startAt, value.intervalWeeks);
      return {
        ...value,
        lessonIds,
        sessionSchedule: lessonIds.reduce<Record<string, string>>((acc, id) => {
          acc[id] = value.sessionSchedule[id] || autoSchedule[id];
          return acc;
        }, {}),
        manualScheduleIds: value.manualScheduleIds.filter((id) => lessonIds.includes(id))
      };
    });
  }

  function changeStartAt(startAt: string) {
    setForm((value) => ({
      ...value,
      startAt,
      ...(createMode === "series"
        ? {
            sessionSchedule: mergeAutoSchedule(
              value.lessonIds,
              startAt,
              value.intervalWeeks,
              value.sessionSchedule,
              value.manualScheduleIds
            )
          }
        : {})
    }));
  }

  function changeIntervalWeeks(intervalWeeks: number) {
    setForm((value) => ({
      ...value,
      intervalWeeks,
      sessionSchedule: mergeAutoSchedule(
        value.lessonIds,
        value.startAt,
        intervalWeeks,
        value.sessionSchedule,
        value.manualScheduleIds
      )
    }));
  }

  function applyAutoSchedule() {
    setForm((value) => ({
      ...value,
      sessionSchedule: buildAutoSchedule(value.lessonIds, value.startAt, value.intervalWeeks),
      manualScheduleIds: []
    }));
  }

  function updateSessionTime(lessonId: string, startAt: string) {
    setForm((value) => ({
      ...value,
      sessionSchedule: { ...value.sessionSchedule, [lessonId]: startAt },
      manualScheduleIds: value.manualScheduleIds.includes(lessonId)
        ? value.manualScheduleIds
        : [...value.manualScheduleIds, lessonId]
    }));
  }

  function create() {
    if (!form.classId || !form.teacherId) return;
    const start = new Date(form.startAt);
    const end = new Date(start.getTime() + Number(form.durationMinutes) * 60_000);
    if (createMode === "single") {
      const result = run(
        () =>
          platform.createSession({
            schoolId: form.schoolId,
            title: form.title || `${getLesson(state, form.lessonId)?.title} · 大班课`,
            lessonId: form.lessonId,
            teacherId: form.teacherId,
            classId: form.classId,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            capacity: Number(form.capacity),
            bookingCloseAt: new Date(start.getTime() - 30 * 60_000).toISOString(),
            cancelCloseAt: new Date(start.getTime() - 2 * 60 * 60_000).toISOString(),
            roomLabel: form.roomLabel,
            actorId: user.id
          }),
        t("operator.sessionCreated")
      );
      if (result.ok) closeFormModal();
      return;
    }
    if (createMode === "edit") {
      if (!editingSessionId) return;
      const result = run(
        () =>
          platform.updateSession({
            sessionId: editingSessionId,
            patch: {
              title: form.title.trim() || `${getLesson(state, form.lessonId)?.title} · 大班课`,
              classId: form.classId,
              lessonId: form.lessonId,
              teacherId: form.teacherId,
              startAt: start.toISOString(),
              endAt: end.toISOString(),
              capacity: Number(form.capacity),
              bookingCloseAt: new Date(start.getTime() - 30 * 60_000).toISOString(),
              cancelCloseAt: new Date(start.getTime() - 2 * 60 * 60_000).toISOString(),
              roomLabel: form.roomLabel
            },
            actorId: user.id,
            reason: academic ? "学校教务调整本校课次" : "教学管理调整课次"
          }),
        "课次已更新"
      );
      if (result.ok) closeFormModal();
      return;
    }
    if (createMode === "series") {
      if (form.lessonIds.length < 2) return;
      if (form.lessonIds.some((lessonId) => !form.sessionSchedule[lessonId])) return;
      const sessionSchedule = form.lessonIds.map((lessonId) => ({
        lessonId,
        startAt: new Date(form.sessionSchedule[lessonId]).toISOString()
      }));
      const themeName = state.folders.find((folder) => folder.id === form.folderId)?.name ?? "系列";
      const result = run(
        () =>
          platform.createSeries({
            schoolId: form.schoolId,
            title: form.title || `${themeName} · 系列课程`,
            classId: form.classId,
            folderId: form.folderId,
            lessonIds: form.lessonIds,
            sessionSchedule,
            teacherId: form.teacherId,
            startAt: start.toISOString(),
            intervalWeeks: Number(form.intervalWeeks),
            durationMinutes: Number(form.durationMinutes),
            capacity: Number(form.capacity),
            roomLabel: form.roomLabel,
            description: form.description,
            actorId: user.id
          }),
        t("operator.seriesCreated")
      );
      if (result.ok) closeFormModal();
    }
  }

  const scheduleSeries = state.series.find((item) => item.id === scheduleSeriesId);
  const cancellingSession = state.sessions.find((session) => session.id === cancelSessionId);

  /** 打开某系列班的时间配置：先把每个课次的当前时间填进表单。 */
  function openSeriesSchedule(seriesId: string) {
    const target = state.series.find((item) => item.id === seriesId);
    if (!target) return;
    const times: Record<string, string> = {};
    target.sessionIds.forEach((sessionId) => {
      const session = getSession(state, sessionId);
      if (session) times[sessionId] = inputDateTime(session.startAt);
    });
    setSeriesTimes(times);
    setScheduleSeriesId(seriesId);
  }

  /** 以第 1 课的时间为基准，按每周一节重排后续课次。 */
  function spreadSeriesTimes() {
    setSeriesTimes((value) => {
      const firstValue = scheduleSeries?.sessionIds.map((sessionId) => value[sessionId]).find(Boolean);
      const first = new Date(firstValue ?? "");
      if (Number.isNaN(first.getTime()) || !scheduleSeries) return value;
      const next = { ...value };
      scheduleSeries.sessionIds.forEach((sessionId, index) => {
        const slot = new Date(first.getTime());
        slot.setDate(slot.getDate() + index * 7);
        next[sessionId] = inputDateTime(slot);
      });
      return next;
    });
  }

  function saveSeriesSchedule() {
    if (!scheduleSeries) return;
    const entries = scheduleSeries.sessionIds
      .map((sessionId) => ({ sessionId, value: seriesTimes[sessionId] }))
      .filter((item) => Boolean(item.value));
    if (!entries.length) return;
    if (entries.some((item) => Number.isNaN(new Date(item.value).getTime()))) return;
    const result = run(
      () =>
        platform.updateSeriesSchedule({
          seriesId: scheduleSeries.id,
          schedule: entries.map((item) => ({ sessionId: item.sessionId, startAt: new Date(item.value).toISOString() })),
          actorId: user.id,
          reason: academic ? "学校教务调整本校系列班课次时间" : "教学管理调整系列班课次时间"
        }),
      "系列班课次时间已更新"
    );
    if (result.ok) setScheduleSeriesId(null);
  }

  const isViewingSession = createMode === "view";

  return (
    <>
      {academic && pendingRequests.length > 0 && (
        <Card className="teacher-request-panel">
          <div className="card-heading">
            <div>
              <span className="eyebrow">Teacher requests</span>
              <h2>教师申请（{pendingRequests.length}）</h2>
              <p>{academic ? "排课、容量与名单由学校教务维护" : "排课、容量与名单由教学管理维护"}；老师只能提交申请，处理结果会通知对方。</p>
            </div>
            <Inbox size={20} />
          </div>
          <div className="teacher-request-list">
            {pendingRequests.map((request) => {
              const session = getSession(state, request.sessionId);
              const teacher = state.users.find((item) => item.id === request.teacherId);
              return (
                <article key={request.id}>
                  <div>
                    <strong>{session?.title ?? "课次已删除"}</strong>
                    <small>
                      {teacher?.name} · {requestKindLabels[request.kind]} · {formatDateTime(request.createdAt, state.ui.timeZone, state.ui.language)}
                      {session ? ` · 原时间 ${formatDateTime(session.startAt, state.ui.timeZone, state.ui.language)}` : ""}
                    </small>
                    <p>{request.reason}</p>
                  </div>
                  <div className="teacher-request-actions">
                    <Button size="sm" variant="secondary" onClick={() => session && navigate(`${basePath}/sessions/${session.id}`)}>查看课次</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(() => platform.resolveChangeRequest({ requestId: request.id, status: "rejected", resolutionNote: "教学管理已沟通，暂不调整排课。", actorId: user.id }), "已驳回申请")}
                    >
                      驳回
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => run(() => platform.resolveChangeRequest({ requestId: request.id, status: "handled", resolutionNote: "教学管理已调整排课，请查看最新课表。", actorId: user.id }), "已处理申请")}
                    >
                      标记已处理
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </Card>
      )}

      <PageHeader
        eyebrow="Course scheduling"
        title={t("operator.sessionTitle")}
        description={academic ? "学校教务统一维护本校课次时间、授课教师、容量与预约规则。" : "从已有班级安排单次课次；班级名单在「班级与学生」中维护。"}
      />

      <Card className="operator-schedule-filter-card">
        <div className="operator-schedule-filter-top">
          <div className="search-box">
            <Search size={17} />
            <TextInput
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="搜索课次、班级、教师或课节"
            />
            {query && (
              <button
                type="button"
                className="operator-schedule-search-clear"
                aria-label="清除搜索"
                onClick={() => changeQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {tab === "sessions" && (
            <div className="operator-schedule-filter-menu" ref={filterPopoverRef}>
              <Button
                variant="secondary"
                className={`operator-schedule-filter-toggle${activeFilterCount ? " is-active" : ""}`}
                aria-expanded={filtersOpen}
                aria-controls={filtersOpen ? "operator-schedule-filter-panel" : undefined}
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <Filter size={16} />
                筛选
                {activeFilterCount > 0 && (
                  <span className="operator-schedule-filter-count">{activeFilterCount}</span>
                )}
              </Button>
              {filtersOpen && (
                <div
                  className="operator-schedule-filter-popover"
                  id="operator-schedule-filter-panel"
                  role="group"
                  aria-label="排课筛选"
                >
                  <div className="operator-schedule-filter-popover-head">
                    <div>
                      <strong>筛选课次</strong>
                      <small>{academic ? "按班级、教师或日期缩小范围" : "按学校、班级、教师或日期缩小范围"}</small>
                    </div>
                    <Button size="icon" variant="ghost" aria-label="关闭筛选" onClick={() => setFiltersOpen(false)}>
                      <X size={16} />
                    </Button>
                  </div>
                  <div className="operator-schedule-filter-grid">
                    {!academic && (
                      <Field label="学校" className="operator-schedule-school-field">
                        <Select
                          aria-label="按学校筛选"
                          value={schoolFilter}
                          onChange={(event) => {
                            setSchoolFilter(event.target.value);
                            setClassFilter("all");
                            setTeacherFilter("all");
                          }}
                        >
                          <option value="all">全部学校</option>
                          {filterSchools.map((school) => (
                            <option key={school.id} value={school.id}>{school.name}</option>
                          ))}
                        </Select>
                      </Field>
                    )}
                    <Field label="班级" className="operator-schedule-class-field">
                      <Select
                        aria-label="按班级筛选"
                        value={classFilter}
                        onChange={(event) => setClassFilter(event.target.value)}
                      >
                        <option value="all">全部班级</option>
                        {filterClasses.map((classItem) => (
                          <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="教师" className="operator-schedule-teacher-field">
                      <Select
                        aria-label="按教师筛选"
                        value={teacherFilter}
                        onChange={(event) => setTeacherFilter(event.target.value)}
                      >
                        <option value="all">全部教师</option>
                        {filterTeachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="日期（学校当地）"
                      hint="按学校当地日期匹配，不随查看者时区变化。"
                      className="operator-schedule-date-field"
                    >
                      <TextInput
                        aria-label="按日期筛选"
                        type="date"
                        value={dateFilter}
                        onChange={(event) => {
                          setDateFilter(event.target.value);
                          if (event.target.value) changeSessionTimeTab("all");
                        }}
                      />
                    </Field>
                  </div>
                  <div className="operator-schedule-filter-popover-foot">
                    <Button variant="ghost" onClick={clearSessionFilters} disabled={activeFilterCount === 0}>
                      重置筛选
                    </Button>
                    <Button variant="secondary" onClick={() => setFiltersOpen(false)}>完成</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {activeFilterCount > 0 && (
          <div className="operator-schedule-active-filters" aria-label="已选筛选">
            <span className="operator-schedule-active-filters-label">已选</span>
            {selectedSchool && (
              <button
                type="button"
                className="operator-schedule-filter-chip"
                aria-label={`移除学校筛选：${selectedSchool.name}`}
                onClick={() => {
                  setSchoolFilter("all");
                  setClassFilter("all");
                  setTeacherFilter("all");
                }}
              >
                {selectedSchool.name}
                <X size={12} />
              </button>
            )}
            {selectedClass && (
              <button
                type="button"
                className="operator-schedule-filter-chip"
                aria-label={`移除班级筛选：${selectedClass.name}`}
                onClick={() => setClassFilter("all")}
              >
                {selectedClass.name}
                <X size={12} />
              </button>
            )}
            {selectedTeacher && (
              <button
                type="button"
                className="operator-schedule-filter-chip"
                aria-label={`移除教师筛选：${selectedTeacher.name}`}
                onClick={() => setTeacherFilter("all")}
              >
                {selectedTeacher.name}
                <X size={12} />
              </button>
            )}
            {dateFilter && (
              <button
                type="button"
                className="operator-schedule-filter-chip"
                aria-label={`移除日期筛选：${dateFilter}`}
                onClick={() => setDateFilter("")}
              >
                {dateFilter.replaceAll("-", "/")}
                <X size={12} />
              </button>
            )}
            <button type="button" className="operator-schedule-filter-clear" onClick={clearSessionFilters}>
              清除筛选
            </button>
          </div>
        )}
      </Card>

      {tab === "sessions" && (
        <div className="section-heading-row schedule-time-tabs">
          <Tabs
            value={sessionTimeTab}
            onChange={changeSessionTimeTab}
            items={[
              { value: "upcoming", label: "即将开始", count: upcomingSingleSessions.length },
              { value: "history", label: "历史课程", count: historySingleSessions.length },
              { value: "all", label: "全部", count: singleSessions.length }
            ]}
          />
          <div className="schedule-time-tabs-actions">
            {showFilteredCount && (
              <span className="schedule-result-count">
                筛选后 {visibleSingleSessions.length} / 共 {currentTabSessionCount} 个课次
              </span>
            )}
            <Button className="operator-schedule-create-action" onClick={() => openCreate("single")}>
              <CalendarPlus size={17} /> {t("operator.newSession")}
            </Button>
          </div>
        </div>
      )}

      {tab === "sessions" && (
        <div className="session-list">
          {visibleSingleSessions.map((session) => (
            <OperatorSessionCard
              key={session.id}
              state={state}
              session={session}
              actions={
                <>
                  {(session.status === "cancelled" || new Date(session.endAt).getTime() < Date.now()) && (
                    <Button variant="ghost" onClick={() => openViewSession(session.id)}>详情</Button>
                  )}
                  {canRescheduleSession(session) && (
                    <Button variant="ghost" className="operator-session-edit" onClick={() => openEditSession(session.id)}>编辑</Button>
                  )}
                  <Button variant="ghost" onClick={() => setRosterSessionId(session.id)}>名单</Button>
                  {canCancelSession(session) && (
                    <Button
                      variant="ghost"
                      className="operator-session-cancel"
                      onClick={() => openCancelSession(session.id)}
                    >
                      取消
                    </Button>
                  )}
                </>
              }
            />
          ))}
          {visibleSingleSessions.length === 0 && (
            <EmptyState
              title={hasActiveFilters
                ? "没有匹配的课次"
                : sessionTimeTab === "upcoming"
                  ? "暂无即将开始的课次"
                  : sessionTimeTab === "history"
                    ? "暂无历史课程"
                    : "暂无匹配课次"}
              description={hasActiveFilters ? "调整学校、班级、教师、日期或搜索条件后重试。" : undefined}
            />
          )}
        </div>
      )}

      {tab === "series" && (
        <div className="series-grid">
          {state.series.map((series) => {
            const seriesSessions = series.sessionIds
              .map((id) => getSession(state, id))
              .filter((session): session is ClassSession => Boolean(session));
            const lesson = getLesson(state, series.lessonId);
            const enrolled = seriesSessions.reduce((sum, session) => sum + (session ? getBookedCount(state, session.id) : 0), 0);
            const firstSession = [...seriesSessions].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];
            return (
              <Card className="operator-series-card" key={series.id}>
                <div className="series-cover" style={{ background: `linear-gradient(145deg, ${lesson?.color}, #eef0ff)` }}>
                  <span>{lesson?.coverEmoji}</span>
                  <Badge tone="purple">{series.lessonIds.length} 个课节 · {series.sessionIds.length} 次课</Badge>
                </div>
                <div className="series-body">
                  <h2>{series.title}</h2>
                  <p>{series.description}</p>
                  <p className="series-lesson-chain">
                    {series.lessonIds.map((lessonId) => getLesson(state, lessonId)?.title).filter(Boolean).join(" → ")}
                  </p>
                  <div className="series-meta">
                    <span><GraduationCap size={16} /> {seriesSessions[0]?.className ?? "待分配班级"}</span>
                    <span><Layers3 size={16} /> 每 {series.durationMinutes} 分钟</span>
                    <span><UsersRound size={16} /> {series.capacity} 人容量</span>
                  </div>
                  <SeriesSessionDots
                    sessions={seriesSessions}
                    renderSession={(session) => (
                      <button key={session.id} onClick={() => navigate(`${basePath}/sessions/${session.id}`)}>
                        <strong>{new Intl.DateTimeFormat(state.ui.language, { timeZone: state.ui.timeZone, day: "2-digit" }).format(new Date(session.startAt))}</strong>
                        <small>{getBookedCount(state, session.id)}/{session.capacity}</small>
                      </button>
                    )}
                  />
                  <div className="operator-series-footer">
                    <div>
                      <span>累计预约课次</span>
                      <strong>{enrolled}</strong>
                    </div>
                    <ProgressBar value={seriesSessions.length ? (enrolled / (series.capacity * seriesSessions.length)) * 100 : 0} />
                  </div>
                  <div className="operator-series-actions">
                    <small>{firstSession ? `首课 ${formatDateTime(firstSession.startAt, state.ui.timeZone, state.ui.language)}` : "暂未排课次时间"}</small>
                    <Button size="sm" variant="secondary" onClick={() => openSeriesSchedule(series.id)}>
                      <CalendarClock size={15} /> 配置课次时间
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(scheduleSeries)}
        title={scheduleSeries ? `配置课次时间 · ${scheduleSeries.title}` : "配置课次时间"}
        onClose={() => setScheduleSeriesId(null)}
        width="760px"
        footer={
          <div className="modal-footer-split">
            <small>保存时会整组校验教师时间冲突；有冲突则所有课次保持原时间。已预约学生会收到时间变更通知。</small>
            <div>
              <Button variant="ghost" onClick={() => setScheduleSeriesId(null)}>取消</Button>
              <Button onClick={saveSeriesSchedule} disabled={!scheduleSeries?.sessionIds.some((sessionId) => seriesTimes[sessionId])}>保存课次时间</Button>
            </div>
          </div>
        }
      >
        {scheduleSeries && (
          <>
            <div className="series-schedule-list">
              {scheduleSeries.sessionIds.map((sessionId, index) => {
                const session = getSession(state, sessionId);
                if (!session) return null;
                const itemLesson = getLesson(state, session.lessonId);
                const durationMinutes = Math.max(
                  1,
                  Math.round((new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) / 60000)
                );
                return (
                  <label key={sessionId} className="series-schedule-row">
                    <span className="series-schedule-index">第 {index + 1} 课</span>
                    <span className="series-schedule-copy">
                      <strong>{itemLesson?.coverEmoji} {itemLesson?.title}</strong>
                      <small>{session.className} · 每次 {durationMinutes} 分钟 · {session.roomLabel}</small>
                    </span>
                    <TextInput
                      type="datetime-local"
                      value={seriesTimes[sessionId] ?? ""}
                      onChange={(event) => setSeriesTimes((value) => ({ ...value, [sessionId]: event.target.value }))}
                    />
                  </label>
                );
              })}
            </div>
            <div className="series-schedule-toolbar">
              <small>默认保留每个课次当前的时长与间隔；点「按每周顺延」会用第 1 课时间重排后续课次。</small>
              <Button size="sm" variant="ghost" onClick={spreadSeriesTimes}>按每周顺延</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={Boolean(createMode)}
        title={isViewingSession ? "课次详情" : createMode === "edit" ? "编辑课次" : createMode === "series" ? t("operator.newSeries") : t("operator.newSession")}
        onClose={closeFormModal}
        width="720px"
        footer={
          isViewingSession ? (
            <div className="modal-footer-split">
              <small>历史课次仅供查看，不可修改。</small>
              <div>
                <Button variant="secondary" onClick={closeFormModal}>关闭详情</Button>
              </div>
            </div>
          ) : (
            <div className="modal-footer-split">
              <small>
                {createMode === "series"
                  ? `已选 ${form.lessonIds.length} 个课节 · ${form.lessonIds.filter((id) => form.sessionSchedule[id]).length} 个课次已排时间`
                  : createMode === "edit"
                    ? "保存时会重新校验班级与教师时间冲突，并通知已预约学生"
                    : "排课时会检查班级与教师时间冲突"}
              </small>
              <div>
                <Button variant="ghost" onClick={closeFormModal}>取消</Button>
                <Button
                  disabled={!form.classId || !form.teacherId || (createMode === "series" && (form.lessonIds.length < 2 || form.lessonIds.some((id) => !form.sessionSchedule[id])))}
                  onClick={create}
                >
                  {createMode === "edit" ? "保存修改" : "确认排课"}
                </Button>
              </div>
            </div>
          )
        }
      >
        <div className={`editor-grid${isViewingSession ? " operator-session-form-view" : ""}`}>
          <Field label="课次标题" className="field-span-2">
            <TextInput
              value={form.title}
              readOnly={isViewingSession}
              onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
              placeholder={createMode === "series" ? "留空则按主题名自动生成" : "留空则按课节名自动生成"}
            />
          </Field>
          {!academic && createMode !== "edit" && (
            <Field label="所属学校">
              <Select
                value={form.schoolId}
                disabled={isViewingSession}
                onChange={(event) => changeSchool(event.target.value)}
              >
                {state.schools.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="班级">
            <Select
              value={form.classId}
              disabled={isViewingSession}
              onChange={(event) => {
                const classId = event.target.value;
                const classGroup = state.classes.find((item) => item.id === classId);
                setForm((value) => ({ ...value, classId, schoolId: classGroup?.schoolId ?? value.schoolId, teacherId: classGroup?.teacherId ?? value.teacherId }));
              }}
            >
              {availableClasses.length === 0 && <option value="">该校暂无可用班级</option>}
              {availableClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <small>
              {isViewingSession
                ? "历史课次展示当时的班级与名单，不可更改。"
                : createMode === "edit"
                ? "更换班级会按新班成员重建本次课名单；原班级成员不会自动迁移。"
                : "建课时会从班级成员生成本次课名单，之后可在「名单」中同步。"}
            </small>
          </Field>
          {createMode === "series" ? (
            <>
              <Field label="课程">
                <Select value={form.folderId} onChange={(event) => chooseTheme(event.target.value)}>
                  {themeFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </Select>
              </Field>
              <div className="field field-span-2">
                <span className="field-label">系列课节（已选 {form.lessonIds.length} 个，按课程顺序开课）</span>
                <div className="assign-session-list">
                  {themeLessons.map((lesson) => {
                    const checked = form.lessonIds.includes(lesson.id);
                    return (
                      <label key={lesson.id} className={`assign-session-row ${checked ? "selected" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSeriesLesson(lesson.id)} />
                        <span className="assign-session-copy">
                          <strong>{lesson.coverEmoji} {lesson.title}</strong>
                          <small>{lesson.subtitle} · {lesson.durationMinutes} 分钟</small>
                        </span>
                        <Badge tone={checked ? "mint" : "neutral"}>
                          {checked ? `第 ${form.lessonIds.indexOf(lesson.id) + 1} 课` : "未选"}
                        </Badge>
                      </label>
                    );
                  })}
                  {themeLessons.length === 0 && <p className="muted-copy">这个主题下还没有课节，请先到课程目录创建。</p>}
                </div>
                <small>系列课程由同一主题下的多个课节组成，每个课节生成一个课次；至少选择两个课节。</small>
              </div>
            </>
          ) : (
            <Field label="课节">
              <Select
                value={form.lessonId}
                disabled={isViewingSession}
                onChange={(event) => setForm((value) => ({ ...value, lessonId: event.target.value }))}
              >
                {state.lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
              </Select>
            </Field>
          )}
          <Field label={t("operator.teacherAssignment")}>
            <Select
              value={form.teacherId}
              disabled={isViewingSession}
              onChange={(event) => setForm((value) => ({ ...value, teacherId: event.target.value }))}
            >
              {availableTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </Select>
          </Field>
          <Field label={createMode === "series" ? "首节课时间（用于自动预排）" : "开始时间"}>
            <TextInput
              type="datetime-local"
              value={form.startAt}
              readOnly={isViewingSession}
              onChange={(event) => changeStartAt(event.target.value)}
            />
          </Field>
          <Field label="单次时长（分钟）">
            <TextInput
              type="number"
              value={form.durationMinutes}
              readOnly={isViewingSession}
              onChange={(event) => setForm((value) => ({ ...value, durationMinutes: Number(event.target.value) }))}
            />
          </Field>
          <Field label={t("common.capacity")}>
            <TextInput
              type="number"
              value={form.capacity}
              readOnly={isViewingSession}
              onChange={(event) => setForm((value) => ({ ...value, capacity: Number(event.target.value) }))}
            />
          </Field>
          <Field label="教室（选填）">
            <TextInput
              value={form.roomLabel}
              readOnly={isViewingSession}
              onChange={(event) => setForm((value) => ({ ...value, roomLabel: event.target.value }))}
              placeholder="选填，例如：大班教室 A"
            />
          </Field>
          {createMode === "series" && (
            <>
              <Field label="课节间隔（周）">
                <TextInput type="number" value={form.intervalWeeks} onChange={(event) => changeIntervalWeeks(Number(event.target.value))} />
              </Field>
              <Field label="系列说明" className="field-span-2">
                <textarea className="input textarea" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} />
              </Field>
              <div className="field field-span-2">
                <span className="field-label">课次时间安排（AI 预排，可逐节调整）</span>
                <div className="series-schedule-list">
                  {form.lessonIds.map((lessonId, index) => {
                    const lesson = getLesson(state, lessonId);
                    return (
                      <label key={lessonId} className="series-schedule-row">
                        <span className="series-schedule-index">第 {index + 1} 课</span>
                        <span className="series-schedule-copy">
                          <strong>{lesson?.coverEmoji} {lesson?.title}</strong>
                          <small>{lesson?.subtitle}</small>
                        </span>
                        <TextInput
                          type="datetime-local"
                          value={form.sessionSchedule[lessonId] ?? ""}
                          onChange={(event) => updateSessionTime(lessonId, event.target.value)}
                        />
                      </label>
                    );
                  })}
                  {form.lessonIds.length === 0 && <p className="muted-copy">先选择课节，系统会按首节课时间与间隔自动预排。</p>}
                </div>
                <div className="series-schedule-toolbar">
                  <small>AI 按「首节课时间 + 课节间隔」预排；手动改过的课次不会被自动覆盖，点「重新自动预排」可整体重排。</small>
                  <Button size="sm" variant="ghost" disabled={form.lessonIds.length === 0} onClick={applyAutoSchedule}>重新自动预排</Button>
                </div>
              </div>
            </>
          )}
        </div>
        {!isViewingSession && (
          <div className="schedule-preview-note">
            <WandSparkles size={20} />
            <div>
              <strong>自动配置预约窗口</strong>
              <span>开课前 30 分钟关闭预约，开课前 2 小时关闭学生自主取消。</span>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(cancellingSession)}
        title="取消课次"
        onClose={() => setCancelSessionId(null)}
        footer={
          <div className="modal-footer-split">
            <small>取消原因仅用于内部记录，不会展示给学生。</small>
            <div>
              <Button variant="ghost" onClick={() => setCancelSessionId(null)}>再想想</Button>
              <Button variant="danger" onClick={confirmSessionCancel}>
                确定取消
              </Button>
            </div>
          </div>
        }
      >
        {cancellingSession && (
          <div className="editor-grid">
            <div className="field field-span-2">
              <strong>确定取消「{cancellingSession.title}」吗？</strong>
              <small>{cancellingSession.className} · 已产生的课堂记录会保留。</small>
            </div>
            <Field label="取消原因（选填）" className="field-span-2">
              <textarea
                className="input textarea"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="例如：教师临时调整（仅内部记录）"
              />
            </Field>
          </div>
        )}
      </Modal>

      {rosterSessionId && (
        <OperatorSessionRosterModal
          state={state}
          sessionId={rosterSessionId}
          actorId={user.id}
          onClose={() => setRosterSessionId(null)}
        />
      )}
    </>
  );
}
