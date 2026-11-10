import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, CalendarDays, Filter, Layers3, PlayCircle, Search, Send, X } from "lucide-react";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getBookedCount, getLesson, getSchoolTimeZone, getTeacherSessions, sessionRuntimeStatus } from "../../lib/domain";
import { Button, Card, EmptyState, Field, PageHeader, Select, Tabs, TextInput } from "../../components/ui";
import { TeacherSessionCard } from "../../components/TeacherSessionCard";
import { CalendarModal } from "../../components/CalendarModal";
import { PmNote } from "../../components/PmNote";
import { SessionRosterModal } from "../../components/SessionRosterModal";
import { SessionChangeRequestModal } from "../../components/SessionChangeRequestModal";

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

export function TeacherSchedule() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = usePlatformStore((store) => store.state);
  const user = currentUser(state);
  const baseSessions = getTeacherSessions(state, user.id);
  const sessions = baseSessions;
  const [tab, setTab] = useState<"upcoming" | "past" | "all">("upcoming");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarInitialDate, setCalendarInitialDate] = useState<string | null>(null);
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const tabBeforeSearchRef = useRef<"upcoming" | "past" | "all" | null>(null);
  const [rosterSessionId, setRosterSessionId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // 消息中心的通知会带着 ?roster=课次 跳进来，直接弹出预约名单。
  useEffect(() => {
    const rosterId = searchParams.get("roster");
    if (!rosterId) return;
    setRosterSessionId(rosterId);
    const next = new URLSearchParams(searchParams);
    next.delete("roster");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const sessionId = searchParams.get("focus");
    if (!sessionId) return;
    const target = sessions.find((session) => session.id === sessionId);
    if (target) {
      const status = sessionRuntimeStatus(target);
      setTab(status === "ended" || status === "cancelled" ? "past" : "upcoming");
      setQuery("");
      setClassFilter("all");
      setCourseFilter("all");
      setDateFilter("");
      setFiltersOpen(false);
      tabBeforeSearchRef.current = null;
      setFocusedSessionId(target.id);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, sessions]);

  useEffect(() => {
    const requestedDate = searchParams.get("calendar");
    if (!requestedDate) return;
    if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      setCalendarInitialDate(requestedDate);
      setCalendarOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("calendar");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!focusedSessionId) return;
    const scrollTimer = window.setTimeout(() => {
      const card = Array.from(document.querySelectorAll<HTMLElement>("[data-session-id]")).find(
        (element) => element.dataset.sessionId === focusedSessionId
      );
      if (!card) return;
      card.scrollIntoView?.({ behavior: "smooth", block: "center" });
      card.focus({ preventScroll: true });
    }, 0);
    const highlightTimer = window.setTimeout(() => setFocusedSessionId(null), 2400);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [focusedSessionId, tab]);

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

  const normalizedQuery = query.trim().toLowerCase();
  const classOptions = Array.from(
    sessions.reduce((options, session) => {
      options.set(session.classId || session.className, session.className);
      return options;
    }, new Map<string, string>())
  )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const courseOptions = Array.from(
    sessions.reduce((options, session) => {
      const lesson = getLesson(state, session.lessonId);
      const course = lesson ? state.folders.find((folder) => folder.id === lesson.folderId) : undefined;
      if (course) options.set(course.id, course.name);
      return options;
    }, new Map<string, string>())
  )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const matchingSessions = sessions.filter((session) => {
    if (classFilter !== "all" && (session.classId || session.className) !== classFilter) return false;
    const lesson = getLesson(state, session.lessonId);
    const course = lesson ? state.folders.find((folder) => folder.id === lesson.folderId) : undefined;
    if (courseFilter !== "all" && course?.id !== courseFilter) return false;
    if (dateFilter && dateKeyInTimeZone(session.startAt, getSchoolTimeZone(state, session.schoolId)) !== dateFilter) {
      return false;
    }
    if (!normalizedQuery) return true;
    return [session.title, session.className, lesson?.title ?? "", course?.name ?? ""]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
  const hasActiveFilters = Boolean(query.trim() || dateFilter) || classFilter !== "all" || courseFilter !== "all";
  const activeFilterCount = [classFilter !== "all", courseFilter !== "all", Boolean(dateFilter)].filter(Boolean).length;
  const selectedClass = classFilter !== "all" ? classOptions.find((item) => item.id === classFilter) : undefined;
  const selectedCourse = courseFilter !== "all" ? courseOptions.find((item) => item.id === courseFilter) : undefined;
  const isHistorySession = (session: (typeof sessions)[number]) => {
    const status = sessionRuntimeStatus(session);
    return status === "ended" || status === "cancelled";
  };
  const allUpcomingCount = sessions.filter((session) => !isHistorySession(session)).length;
  const matchingUpcomingCount = matchingSessions.filter((session) => !isHistorySession(session)).length;
  const filtered = matchingSessions.filter((session) => {
    if (tab === "upcoming") return !isHistorySession(session);
    if (tab === "past") return isHistorySession(session);
    return true;
  });
  const currentTabTotalCount = tab === "upcoming"
    ? allUpcomingCount
    : tab === "past"
      ? sessions.length - allUpcomingCount
      : sessions.length;
  const showFilteredCount = hasActiveFilters && filtered.length !== currentTabTotalCount;

  function clearSessionFilters() {
    setClassFilter("all");
    setCourseFilter("all");
    setDateFilter("");
  }

  function changeTab(next: "upcoming" | "past" | "all") {
    setTab(next);
    if (query.trim()) tabBeforeSearchRef.current = next === "all" ? null : next;
  }

  function changeQuery(next: string) {
    const hadQuery = Boolean(query.trim());
    const hasQuery = Boolean(next.trim());
    if (!hadQuery && hasQuery) {
      tabBeforeSearchRef.current = tab === "all" ? null : tab;
      setTab("all");
    } else if (hadQuery && !hasQuery && tabBeforeSearchRef.current) {
      setTab(tabBeforeSearchRef.current);
      tabBeforeSearchRef.current = null;
    }
    setQuery(next);
  }

  return (
    <>
      <PageHeader
        eyebrow="Teaching schedule"
        title={t("nav.schedule")}
        description="查看课堂时间、预约人数和课程内容准备情况。排课归教学管理维护。"
        actions={
          <PmNote kind="注意" note="点击后提交调课、加课或取消申请，结果回到消息中心。一期不做，等教学管理与运营能力完整后再实现。">
            <Button variant="secondary" onClick={() => setRequestOpen(true)}>
              <Send size={16} /> 申请调整
            </Button>
          </PmNote>
        }
      />

      <Card className="operator-schedule-filter-card">
        <div className="operator-schedule-filter-top">
          <div className="search-box">
            <Search size={17} />
            <TextInput
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="搜索课次、班级、课程或课节"
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
          <div className="operator-schedule-filter-menu" ref={filterPopoverRef}>
            <Button
              variant="secondary"
              className={`operator-schedule-filter-toggle${activeFilterCount ? " is-active" : ""}`}
              aria-expanded={filtersOpen}
              aria-controls={filtersOpen ? "teacher-schedule-filter-panel" : undefined}
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
                id="teacher-schedule-filter-panel"
                role="group"
                aria-label="课表筛选"
              >
                <div className="operator-schedule-filter-popover-head">
                  <div>
                    <strong>筛选课次</strong>
                    <small>按班级、课程或日期缩小范围</small>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="关闭筛选" onClick={() => setFiltersOpen(false)}>
                    <X size={16} />
                  </Button>
                </div>
                <div className="operator-schedule-filter-grid">
                  <Field label="班级">
                    <Select
                      aria-label="按班级筛选"
                      value={classFilter}
                      onChange={(event) => setClassFilter(event.target.value)}
                    >
                      <option value="all">全部班级</option>
                      {classOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="课程">
                    <Select
                      aria-label="按课程筛选"
                      value={courseFilter}
                      onChange={(event) => setCourseFilter(event.target.value)}
                    >
                      <option value="all">全部课程</option>
                      {courseOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="日期（学校当地）" hint="按学校当地日期匹配，不随查看者时区变化。">
                    <TextInput
                      aria-label="按日期筛选"
                      type="date"
                      value={dateFilter}
                      onChange={(event) => {
                        setDateFilter(event.target.value);
                        if (event.target.value) changeTab("all");
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
        </div>
        {activeFilterCount > 0 && (
          <div className="operator-schedule-active-filters" aria-label="已选筛选">
            <span className="operator-schedule-active-filters-label">已选</span>
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
            {selectedCourse && (
              <button
                type="button"
                className="operator-schedule-filter-chip"
                aria-label={`移除课程筛选：${selectedCourse.name}`}
                onClick={() => setCourseFilter("all")}
              >
                {selectedCourse.name}
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

      <div className="section-heading-row schedule-time-tabs">
        <PmNote kind="规则" note="即将开始与历史课程按课堂状态划分：老师结束课堂后，课次进入历史课程。">
          <Tabs
            value={tab}
            onChange={changeTab}
            items={[
              { value: "upcoming", label: "即将开始", count: matchingUpcomingCount },
              { value: "past", label: "历史课程", count: matchingSessions.length - matchingUpcomingCount },
              { value: "all", label: "全部", count: matchingSessions.length }
            ]}
          />
        </PmNote>
        <div className="schedule-time-tabs-actions">
          {showFilteredCount && (
            <span className="schedule-result-count">
              筛选后 {filtered.length} / 共 {currentTabTotalCount} 个课次
            </span>
          )}
          <Button
            variant="secondary"
            className="teacher-calendar-action"
            onClick={() => {
              setCalendarInitialDate(null);
              setCalendarOpen(true);
            }}
            aria-label={`课程日历，共 ${sessions.length} 节课`}
          >
            <CalendarDays size={17} />
            课程日历
          </Button>
        </div>
      </div>

      <PmNote block kind="流程" note="备课进入该课次的课前、课中、课后配置；进入课堂打开该课次的课堂运行页。">
        <div className="session-list teacher-session-list">
        {filtered.map((session) => (
          <TeacherSessionCard
            key={session.id}
            state={state}
            session={session}
            focused={focusedSessionId === session.id}
          />
        ))}
        {filtered.length === 0 && (
          <EmptyState
            title={hasActiveFilters ? "没有匹配的课程" : "暂无课程"}
            description={hasActiveFilters ? "调整班级、课程、日期或搜索条件后重试。" : "教学管理排课后会出现在这里。"}
          />
        )}
        </div>
      </PmNote>

      <CalendarModal
        open={calendarOpen}
        onClose={() => {
          setCalendarOpen(false);
          setCalendarInitialDate(null);
        }}
        state={state}
        sessions={sessions}
        initialDate={calendarInitialDate ?? undefined}
        detailSubtitle={(session) => `${getBookedCount(state, session.id)} 人预约`}
        monthNote={(count) => `本月 ${count} 节课`}
        renderAction={(session) => {
          const status = sessionRuntimeStatus(session);
          const ended = status === "ended" || status === "cancelled";
          return (
            <div className="calendar-session-actions">
              <Button size="sm" variant="soft" onClick={() => navigate(`/teacher/session/${session.id}/design`)}>
                <Layers3 size={15} /> {status === "upcoming" ? "备课" : "查看设计"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  navigate(ended
                    ? `/teacher/results?sessionId=${session.id}`
                    : `/teacher/live/${session.id}`)
                }
              >
                {ended ? <><BarChart3 size={15} /> 查看结果</> : <><PlayCircle size={15} /> 进入课堂</>}
              </Button>
            </div>
          );
        }}
      />

      <SessionRosterModal sessionId={rosterSessionId} onClose={() => setRosterSessionId(null)} />

      <SessionChangeRequestModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        sessions={sessions}
        teacherId={user.id}
        defaultSessionId={rosterSessionId ?? undefined}
      />
    </>
  );
}
