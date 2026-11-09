import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2
} from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser } from "../../lib/domain";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, TextInput } from "../../components/ui";
import type { Course, CourseStatus, CourseSubject, Lesson, PlatformState } from "../../domain/types";

type CourseEditorState = "new" | string | null;
type SubjectEditorState = "new" | string | null;
type LessonEditorState = { courseId: string; lesson?: Lesson } | null;
type DeleteTarget = { kind: "course" | "lesson" | "subject"; id: string; label: string } | null;
type StatusFilter = "all" | CourseStatus;

function parseTags(value: string) {
  return value.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean);
}

function statusMeta(status: CourseStatus): { label: string; tone: "neutral" | "mint" | "orange" } {
  if (status === "published") return { label: "已发布", tone: "mint" };
  if (status === "disabled") return { label: "已停用", tone: "orange" };
  return { label: "草稿", tone: "neutral" };
}

function courseHasReferences(state: PlatformState, courseId: string) {
  const lessonIds = new Set(state.lessons.filter((lesson) => lesson.folderId === courseId).map((lesson) => lesson.id));
  return state.series.some((series) => series.folderId === courseId)
    || state.sessions.some((session) => lessonIds.has(session.lessonId))
    || state.interactionSets.some((set) => lessonIds.has(set.lessonId))
    || state.materialRefs.some((ref) => lessonIds.has(ref.lessonId));
}

function lessonHasReferences(state: PlatformState, lessonId: string) {
  return state.sessions.some((session) => session.lessonId === lessonId)
    || state.series.some((series) => series.lessonId === lessonId || (series.lessonIds || []).includes(lessonId))
    || state.interactionSets.some((set) => set.lessonId === lessonId)
    || state.materialRefs.some((ref) => ref.lessonId === lessonId);
}

export function CourseCatalog() {
  const { t } = useTranslation();
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [subjectEditor, setSubjectEditor] = useState<SubjectEditorState>(null);
  const [courseEditor, setCourseEditor] = useState<CourseEditorState>(null);
  const [lessonEditor, setLessonEditor] = useState<LessonEditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const subjects = [...state.subjects].sort((a, b) => a.order - b.order);
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const subjectCourses = selectedSubject ? state.folders.filter((course) => course.subjectId === selectedSubject.id) : state.folders;
  const visibleCourses = subjectCourses
    .filter((course) => statusFilter === "all" || course.status === statusFilter)
    .filter((course) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) return true;
      return course.name.toLowerCase().includes(normalizedQuery)
        || course.description.toLowerCase().includes(normalizedQuery)
        || course.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => a.order - b.order);
  const editingCourse = courseEditor && courseEditor !== "new" ? state.folders.find((course) => course.id === courseEditor) : undefined;
  const editingSubject = subjectEditor && subjectEditor !== "new" ? state.subjects.find((subject) => subject.id === subjectEditor) : undefined;

  function countCourses(subjectId: string) {
    return state.folders.filter((course) => course.subjectId === subjectId).length;
  }

  function changeCourseStatus(course: Course, status: CourseStatus) {
    const message = status === "published" ? "课程已发布" : status === "disabled" ? "课程已停用" : "课程已转为草稿";
    run(() => platform.setCourseStatus({ courseId: course.id, status, actorId: user.id }), message);
  }

  function changeLessonStatus(lesson: Lesson) {
    const status: CourseStatus = lesson.status === "published" ? "disabled" : "published";
    run(
      () => platform.setLessonStatus({ lessonId: lesson.id, status, actorId: user.id }),
      status === "published" ? "课节已发布" : "课节已停用"
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const result = run<unknown>(() => {
      if (deleteTarget.kind === "course") return platform.deleteCourse({ courseId: deleteTarget.id, actorId: user.id });
      if (deleteTarget.kind === "lesson") return platform.deleteLesson({ lessonId: deleteTarget.id, actorId: user.id });
      return platform.deleteSubject({ subjectId: deleteTarget.id, actorId: user.id });
    }, deleteTarget.kind === "course" ? "课程已删除" : deleteTarget.kind === "lesson" ? "课节已删除" : "科目已删除");
    if (!result.ok) return;
    if (deleteTarget.kind === "course" && expandedCourseId === deleteTarget.id) setExpandedCourseId(null);
    if (deleteTarget.kind === "subject" && selectedSubjectId === deleteTarget.id) setSelectedSubjectId("all");
    setDeleteTarget(null);
  }

  const listView = (
    <>
      <PageHeader
        eyebrow="Course structure"
        title={t("operator.courseTree")}
        description="按科目维护课程、课节与发布状态。排课请前往「排课管理」。"
        actions={<><Button variant="secondary" onClick={() => setSubjectEditor("new")}><Plus size={17} /> 新增科目</Button><Button disabled={subjects.length === 0} onClick={() => setCourseEditor("new")}><Plus size={17} /> 新建课程</Button></>}
      />

      <div className="course-catalog-layout">
        <aside className="course-subject-rail" aria-label="科目筛选">
          <div className="course-subject-rail-head">
            <span>科目</span>
            <strong>{subjects.length}</strong>
          </div>
          <button type="button" className={selectedSubjectId === "all" ? "course-subject-item active" : "course-subject-item"} onClick={() => setSelectedSubjectId("all")}>
            <span>全部科目</span><small>{state.folders.length}</small>
          </button>
          {subjects.map((subject) => (
            <button key={subject.id} type="button" className={subject.id === selectedSubjectId ? "course-subject-item active" : "course-subject-item"} onClick={() => setSelectedSubjectId(subject.id)}>
              <span className="course-subject-name"><i style={{ background: subject.color }} />{subject.name}</span>
              <small>{countCourses(subject.id)}</small>
            </button>
          ))}
          {subjects.length === 0 && <p className="course-subject-empty">还没有科目</p>}
        </aside>

        <section className="course-catalog-main">
          <div className="course-catalog-toolbar">
            <div className="course-catalog-copy">
              <span className="eyebrow">Subject</span>
              <div className="course-catalog-title-row">
                <h2>{selectedSubject?.name ?? "全部课程"}</h2>
                {selectedSubject && <Button size="sm" variant="ghost" onClick={() => setSubjectEditor(selectedSubject.id)}><Settings size={15} /> 科目设置</Button>}
              </div>
              <p>{selectedSubject?.description || "从科目进入课程，再维护课程下的课节内容。"}</p>
            </div>
            <span className="course-catalog-count">显示 <strong>{visibleCourses.length}</strong> / {subjectCourses.length} 门课程</span>
          </div>

          <Card className="course-catalog-filters">
            <div className="search-box wide">
              <Search size={17} />
              <TextInput aria-label="搜索课程" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索课程名称、说明或标签" />
            </div>
            <Select aria-label="课程状态" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="disabled">已停用</option>
            </Select>
          </Card>

          {subjects.length === 0 ? (
            <EmptyState title="先创建第一个科目" description="科目是课程的上层分类，例如中文、英语或数学。" action={<Button onClick={() => setSubjectEditor("new")}><Plus size={17} /> 新增科目</Button>} />
          ) : visibleCourses.length === 0 ? (
            <EmptyState
              title={subjectCourses.length === 0 ? "当前科目还没有课程" : "没有符合条件的课程"}
              description={subjectCourses.length === 0 ? "创建课程后，在课程卡片内添加课节。" : "调整搜索词或状态筛选后再试。"}
              action={subjectCourses.length === 0 ? <Button onClick={() => setCourseEditor("new")}><Plus size={17} /> 新建课程</Button> : undefined}
            />
          ) : (
            <div className="course-catalog-list">
              {visibleCourses.map((course) => {
                const meta = statusMeta(course.status);
                const lessons = state.lessons.filter((lesson) => lesson.folderId === course.id).sort((a, b) => a.order - b.order);
                const isExpanded = expandedCourseId === course.id;
                const used = courseHasReferences(state, course.id);
                const canPublish = lessons.some((lesson) => lesson.status === "published");
                return (
                  <article key={course.id} className={`course-list-row is-${course.status}${isExpanded ? " is-open" : ""}`}>
                    <div className="course-list-summary">
                      <button
                        type="button"
                        className="course-list-toggle"
                        onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`course-lessons-${course.id}`}
                        aria-label={`${isExpanded ? "收起课程" : "展开课程"} ${course.name}`}
                      >
                        <ChevronRight className="course-list-chevron" size={17} />
                        <span className="course-list-identity">
                          <strong>{course.name}</strong>
                          <small>{course.description || "暂无课程说明"}</small>
                        </span>
                        <span className="course-list-subject">{subjects.find((subject) => subject.id === course.subjectId)?.name ?? "未分科目"}</span>
                        <span className="course-list-lessons"><BookOpen size={14} /> {lessons.length} 课节</span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </button>
                      <div className="course-list-actions">
                        <Button size="sm" variant="ghost" aria-label={`编辑课程 ${course.name}`} onClick={() => setCourseEditor(course.id)}><Pencil size={14} /> 编辑</Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={course.status === "published" ? `停用课程 ${course.name}` : `发布课程 ${course.name}`}
                          disabled={course.status !== "published" && !canPublish}
                          title={course.status !== "published" && !canPublish ? "至少发布一个课节后才能发布课程" : undefined}
                          onClick={() => changeCourseStatus(course, course.status === "published" ? "disabled" : "published")}
                        >
                          {course.status === "published" ? "停用课程" : "发布课程"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="danger-ghost"
                          aria-label={`删除课程 ${course.name}`}
                          disabled={used}
                          title={used ? "课程已被班级或内容引用，只能停用" : "删除课程"}
                          onClick={() => setDeleteTarget({ kind: "course", id: course.id, label: course.name })}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <section className="course-card-expanded" id={`course-lessons-${course.id}`} aria-label={`${course.name}的课节`}>
                        {lessons.length === 0 ? (
                          <div className="course-lesson-empty">
                            <BookOpen size={18} />
                            <div><strong>还没有课节</strong><p>先添加一个课节，再发布课程。</p></div>
                            <Button size="sm" variant="secondary" onClick={() => setLessonEditor({ courseId: course.id })}><Plus size={15} /> 新建课节</Button>
                          </div>
                        ) : (
                          <div className="course-lesson-table">
                            <div className="course-lesson-table-head">
                              <span>序号</span>
                              <span>课节标题</span>
                              <span>时长</span>
                              <span>状态</span>
                              <Button size="sm" variant="ghost" onClick={() => setLessonEditor({ courseId: course.id })}><Plus size={14} /> 新建课节</Button>
                            </div>
                            {lessons.map((lesson, index) => {
                              const lessonMeta = statusMeta(lesson.status);
                              const lessonUsed = lessonHasReferences(state, lesson.id);
                              return (
                                <div className={`course-lesson-table-row is-${lesson.status}`} key={lesson.id}>
                                  <span className="course-lesson-table-order">{String(index + 1).padStart(2, "0")}</span>
                                  <div className="course-lesson-table-title">
                                    <strong>{lesson.title}</strong>
                                  </div>
                                  <span className="course-lesson-table-duration">{lesson.durationMinutes} 分钟</span>
                                  <Badge tone={lessonMeta.tone}>{lessonMeta.label}</Badge>
                                  <div className="course-lesson-table-actions">
                                    <Button size="icon" variant="ghost" aria-label={`上移课节 ${lesson.title}`} disabled={index === 0} onClick={() => run(() => platform.moveLesson({ lessonId: lesson.id, direction: "up", actorId: user.id }))}><ArrowUp size={15} /></Button>
                                    <Button size="icon" variant="ghost" aria-label={`下移课节 ${lesson.title}`} disabled={index === lessons.length - 1} onClick={() => run(() => platform.moveLesson({ lessonId: lesson.id, direction: "down", actorId: user.id }))}><ArrowDown size={15} /></Button>
                                    <Button size="sm" variant="ghost" onClick={() => setLessonEditor({ courseId: course.id, lesson })}><Pencil size={14} /> 编辑</Button>
                                    <Button size="sm" variant="ghost" className="course-lesson-status-action" onClick={() => changeLessonStatus(lesson)}>{lesson.status === "published" ? "停用" : "发布"}</Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="danger-ghost"
                                      aria-label={`删除课节 ${lesson.title}`}
                                      disabled={lessonUsed}
                                      title={lessonUsed ? "课节已被班级或内容引用，只能停用" : "删除课节"}
                                      onClick={() => setDeleteTarget({ kind: "lesson", id: lesson.id, label: lesson.title })}
                                    >
                                      <Trash2 size={15} />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );

  return (
    <>
      {listView}

      {subjectEditor !== null && (
        <SubjectEditorModal
          subject={editingSubject}
          courseCount={editingSubject ? countCourses(editingSubject.id) : 0}
          onClose={() => setSubjectEditor(null)}
          onSaved={(subject) => {
            setSubjectEditor(null);
            if (!editingSubject) setSelectedSubjectId(subject.id);
          }}
          onRequestDelete={(subject) => {
            setSubjectEditor(null);
            setDeleteTarget({ kind: "subject", id: subject.id, label: subject.name });
          }}
        />
      )}

      {courseEditor !== null && (
        <CourseEditorModal
          course={editingCourse}
          subjects={subjects}
          defaultSubjectId={selectedSubject?.id ?? subjects[0]?.id ?? ""}
          onClose={() => setCourseEditor(null)}
          onSaved={(course) => {
            setCourseEditor(null);
            setExpandedCourseId(course.id);
          }}
        />
      )}

      {lessonEditor && (() => {
        const course = state.folders.find((item) => item.id === lessonEditor.courseId);
        if (!course) return null;
        return (
          <LessonEditorModal
            course={course}
            lesson={lessonEditor.lesson}
            onClose={() => setLessonEditor(null)}
          />
        );
      })()}

      {deleteTarget && (
        <Modal
          open
          title={deleteTarget.kind === "course" ? "删除课程" : deleteTarget.kind === "lesson" ? "删除课节" : "删除科目"}
          onClose={() => setDeleteTarget(null)}
          footer={<div className="modal-footer-split"><small>该操作不可恢复。</small><div><Button variant="ghost" onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="danger" onClick={confirmDelete}>确认删除</Button></div></div>}
        >
          <p>{`确定删除“${deleteTarget.label}”吗？`}</p>
          <p className="muted-copy">已被班级、课次或内容引用的对象只能停用，系统不会删除历史记录。</p>
        </Modal>
      )}
    </>
  );
}

function SubjectEditorModal({
  subject,
  courseCount,
  onClose,
  onSaved,
  onRequestDelete
}: {
  subject?: CourseSubject;
  courseCount: number;
  onClose: () => void;
  onSaved: (subject: CourseSubject) => void;
  onRequestDelete: (subject: CourseSubject) => void;
}) {
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const [form, setForm] = useState({
    name: subject?.name ?? "",
    description: subject?.description ?? "",
    color: subject?.color ?? "#6552ff"
  });

  function save() {
    const result = subject
      ? run(() => platform.updateSubject({ subjectId: subject.id, patch: form, actorId: user.id }), "科目已更新")
      : run(() => platform.createSubject({ ...form, actorId: user.id }), "科目已创建");
    if (result.ok && result.data) onSaved(result.data);
  }

  return (
    <Modal
      open
      title={subject ? "编辑科目" : "新增科目"}
      onClose={onClose}
      footer={
        <div className="modal-footer-split">
          <div>
            {subject ? (
              <Button
                variant="ghost"
                className="danger-ghost"
                disabled={courseCount > 0}
                title={courseCount > 0 ? `该科目下还有 ${courseCount} 门课程` : "删除科目"}
                onClick={() => onRequestDelete(subject)}
              >
                <Trash2 size={15} /> 删除科目
              </Button>
            ) : <small>科目只负责分类，不设发布状态。</small>}
          </div>
          <div>
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button disabled={!form.name.trim()} onClick={save}>{subject ? "保存科目" : "创建科目"}</Button>
          </div>
        </div>
      }
    >
      <div className="editor-grid">
        <Field label="科目名称" className="field-span-2"><TextInput value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="例如：中文" /></Field>
        <Field label="科目说明" className="field-span-2"><textarea className="input textarea" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="说明这个科目包含的课程方向" /></Field>
        <Field label="科目颜色" className="field-span-2"><input className="input color-input" type="color" value={form.color} onChange={(event) => setForm((value) => ({ ...value, color: event.target.value }))} /></Field>
      </div>
      {courseCount > 0 && <p className="muted-copy">该科目下还有 {courseCount} 门课程，需先移走或删除课程后才能删除科目。</p>}
    </Modal>
  );
}

function CourseEditorModal({
  course,
  subjects,
  defaultSubjectId,
  onClose,
  onSaved
}: {
  course?: Course;
  subjects: CourseSubject[];
  defaultSubjectId: string;
  onClose: () => void;
  onSaved: (course: Course) => void;
}) {
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const [form, setForm] = useState({
    subjectId: course?.subjectId ?? defaultSubjectId,
    name: course?.name ?? "",
    description: course?.description ?? "",
    tags: course?.tags.join("，") ?? "",
    color: course?.color ?? "#6552ff"
  });

  function save() {
    const payload = {
      subjectId: form.subjectId,
      name: form.name,
      description: form.description,
      tags: parseTags(form.tags),
      color: form.color,
      actorId: user.id
    };
    const result = course
      ? run(() => platform.updateCourse({ courseId: course.id, patch: payload, actorId: user.id }), "课程已更新")
      : run(() => platform.createCourse(payload), "课程已创建");
    if (result.ok && result.data) onSaved(result.data);
  }

  return (
    <Modal
      open
      title={course ? "编辑课程" : "新建课程"}
      onClose={onClose}
      width="620px"
      footer={<div className="modal-footer-split"><small>{course ? "课程状态不在这里修改。" : "新课程会先保存为草稿，发布后才能进入排课选择。"}</small><div><Button variant="ghost" onClick={onClose}>取消</Button><Button disabled={!form.name.trim() || !form.subjectId} onClick={save}>{course ? "保存课程" : "创建课程"}</Button></div></div>}
    >
      <div className="editor-grid">
        <Field label="所属科目"><Select value={form.subjectId} onChange={(event) => setForm((value) => ({ ...value, subjectId: event.target.value }))}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</Select></Field>
        <Field label="课程名称"><TextInput value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="例如：校园与生活" /></Field>
        <Field label="课程说明" className="field-span-2"><textarea className="input textarea" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="说明课程内容和使用范围" /></Field>
        <Field label="标签" className="field-span-2" hint="用逗号分隔，例如：入门，口语，校园"><TextInput value={form.tags} onChange={(event) => setForm((value) => ({ ...value, tags: event.target.value }))} /></Field>
        <Field label="课程颜色" className="field-span-2"><input className="input color-input" type="color" value={form.color} onChange={(event) => setForm((value) => ({ ...value, color: event.target.value }))} /></Field>
      </div>
    </Modal>
  );
}

function LessonEditorModal({ course, lesson, onClose }: { course: Course; lesson?: Lesson; onClose: () => void }) {
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const [form, setForm] = useState({
    title: lesson?.title ?? "",
    subtitle: lesson?.subtitle ?? "",
    description: lesson?.description ?? "",
    durationMinutes: lesson?.durationMinutes ?? 40,
    tags: lesson?.tags.join("，") ?? "",
    color: lesson?.color ?? course.color,
    coverEmoji: lesson?.coverEmoji ?? "📘"
  });

  function save() {
    const payload = {
      title: form.title,
      subtitle: form.subtitle,
      description: form.description,
      durationMinutes: Number(form.durationMinutes) || 40,
      tags: parseTags(form.tags),
      color: form.color,
      coverEmoji: form.coverEmoji
    };
    const result = lesson
      ? run(() => platform.updateLesson({ lessonId: lesson.id, patch: payload, actorId: user.id }), "课节已更新")
      : run(() => platform.createLesson({ folderId: course.id, ...payload, actorId: user.id }), "课节已创建");
    if (result.ok) onClose();
  }

  return (
    <Modal
      open
      title={lesson ? "编辑课节" : "新建课节"}
      onClose={onClose}
      width="660px"
      footer={<div className="modal-footer-split"><small>{lesson ? `所属课程：${course.name}` : `将创建在“${course.name}”下，默认为草稿。`}</small><div><Button variant="ghost" onClick={onClose}>取消</Button><Button disabled={!form.title.trim()} onClick={save}>{lesson ? "保存课节" : "创建课节"}</Button></div></div>}
    >
      <div className="editor-grid">
        <Field label="课节标题" className="field-span-2"><TextInput value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="例如：认识新朋友" /></Field>
        <Field label="副标题 / 印尼语" className="field-span-2"><TextInput value={form.subtitle} onChange={(event) => setForm((value) => ({ ...value, subtitle: event.target.value }))} /></Field>
        <Field label="课节说明" className="field-span-2"><textarea className="input textarea" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></Field>
        <Field label="时长（分钟）"><TextInput type="number" min={1} value={form.durationMinutes} onChange={(event) => setForm((value) => ({ ...value, durationMinutes: Number(event.target.value) }))} /></Field>
        <Field label="课节标签" hint="用逗号分隔"><TextInput value={form.tags} onChange={(event) => setForm((value) => ({ ...value, tags: event.target.value }))} /></Field>
        <Field label="主题色"><input className="input color-input" type="color" value={form.color} onChange={(event) => setForm((value) => ({ ...value, color: event.target.value }))} /></Field>
        <Field label="封面表情"><TextInput value={form.coverEmoji} onChange={(event) => setForm((value) => ({ ...value, coverEmoji: event.target.value }))} /></Field>
      </div>
    </Modal>
  );
}
