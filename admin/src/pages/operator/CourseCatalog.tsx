import { useEffect, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  TriangleAlert,
  Trash2
} from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser } from "../../lib/domain";
import { Button, EmptyState, Field, Modal, PageHeader, Select, TextInput } from "../../components/ui";
import type { Course, CourseSubject, Lesson, PlatformState } from "../../domain/types";

type CourseEditorState = "new" | string | null;
type SubjectEditorState = "new" | string | null;
type LessonEditorState = { courseId: string; lesson?: Lesson } | null;
type DeleteTarget = { kind: "course" | "lesson" | "subject"; id: string; label: string } | null;
type SubjectDeleteNotice = { name: string; courseCount: number } | null;
type CatalogReferences = { sessions: number; series: number; interactions: number; materials: number };

function parseTags(value: string) {
  return value.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean);
}


function courseReferences(state: PlatformState, courseId: string): CatalogReferences {
  const lessonIds = new Set(state.lessons.filter((lesson) => lesson.folderId === courseId).map((lesson) => lesson.id));
  return {
    sessions: state.sessions.filter((session) => lessonIds.has(session.lessonId)).length,
    series: state.series.filter((series) => series.folderId === courseId || lessonIds.has(series.lessonId) || series.lessonIds.some((lessonId) => lessonIds.has(lessonId))).length,
    interactions: state.interactionSets.filter((set) => lessonIds.has(set.lessonId)).length,
    materials: state.materialRefs.filter((ref) => lessonIds.has(ref.lessonId)).length
  };
}

function lessonReferences(state: PlatformState, lessonId: string): CatalogReferences {
  return {
    sessions: state.sessions.filter((session) => session.lessonId === lessonId).length,
    series: state.series.filter((series) => series.lessonId === lessonId || series.lessonIds.includes(lessonId)).length,
    interactions: state.interactionSets.filter((set) => set.lessonId === lessonId).length,
    materials: state.materialRefs.filter((ref) => ref.lessonId === lessonId).length
  };
}

function referenceCount(references: CatalogReferences) {
  return references.sessions + references.series + references.interactions + references.materials;
}

function closeDetailsMenu(event: MouseEvent<HTMLElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

export function CourseCatalog() {
  const { t } = useTranslation();
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [subjectEditor, setSubjectEditor] = useState<SubjectEditorState>(null);
  const [courseEditor, setCourseEditor] = useState<CourseEditorState>(null);
  const [lessonEditor, setLessonEditor] = useState<LessonEditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [subjectDeleteNotice, setSubjectDeleteNotice] = useState<SubjectDeleteNotice>(null);
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);
  const [dragOverLessonId, setDragOverLessonId] = useState<string | null>(null);

  const subjects = [...state.subjects].sort((a, b) => a.order - b.order);
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const subjectCourses = selectedSubject ? state.folders.filter((course) => course.subjectId === selectedSubject.id) : state.folders;
  const visibleCourses = subjectCourses
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

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      document.querySelectorAll(".course-row-menu[open]").forEach((menu) => {
        if (!menu.contains(event.target as Node)) menu.removeAttribute("open");
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      document.querySelectorAll(".course-row-menu[open]").forEach((menu) => menu.removeAttribute("open"));
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function countCourses(subjectId: string) {
    return state.folders.filter((course) => course.subjectId === subjectId).length;
  }

  function moveLessonToIndex(lessonId: string, targetIndex: number) {
    run(() => platform.reorderLesson({ lessonId, targetIndex, actorId: user.id }));
  }

  function startLessonDrag(event: DragEvent<HTMLButtonElement>, lessonId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", lessonId);
    setDraggingLessonId(lessonId);
  }

  function finishLessonDrag() {
    setDraggingLessonId(null);
    setDragOverLessonId(null);
  }

  function dropLesson(event: DragEvent<HTMLDivElement>, lessons: Lesson[], targetIndex: number) {
    event.preventDefault();
    const lessonId = event.dataTransfer.getData("text/plain") || draggingLessonId;
    if (!lessonId) {
      finishLessonDrag();
      return;
    }
    const sourceIndex = lessons.findIndex((lesson) => lesson.id === lessonId);
    finishLessonDrag();
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    moveLessonToIndex(lessonId, targetIndex);
  }

  function reorderLessonWithKeyboard(event: ReactKeyboardEvent<HTMLButtonElement>, lessons: Lesson[], index: number) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const targetIndex = index + (event.key === "ArrowUp" ? -1 : 1);
    if (targetIndex < 0 || targetIndex >= lessons.length) return;
    moveLessonToIndex(lessons[index].id, targetIndex);
  }



  function confirmDelete() {
    if (!deleteTarget) return;
    const result = run<unknown>(() => {
      if (deleteTarget.kind === "course") return platform.deleteCourse({ courseId: deleteTarget.id, actorId: user.id });
      if (deleteTarget.kind === "lesson") return platform.deleteLesson({ lessonId: deleteTarget.id, actorId: user.id });
      return platform.deleteSubject({ subjectId: deleteTarget.id, actorId: user.id });
    }, deleteTarget.kind === "course" ? "课程已删除" : deleteTarget.kind === "lesson" ? "课节已删除" : "科目已删除");
    if (!result.ok) return;
    if (deleteTarget.kind === "course") {
      setExpandedCourseIds((current) => {
        if (!current.has(deleteTarget.id)) return current;
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
    }
    if (deleteTarget.kind === "subject" && selectedSubjectId === deleteTarget.id) setSelectedSubjectId("all");
    setDeleteTarget(null);
  }

  function stopDeleteTarget() {
    if (!deleteTarget || deleteTarget.kind === "subject") return;
    const result = deleteTarget.kind === "course"
      ? run(() => platform.setCourseStatus({ courseId: deleteTarget.id, status: "disabled", actorId: user.id }), "课程已停用")
      : run(() => platform.setLessonStatus({ lessonId: deleteTarget.id, status: "disabled", actorId: user.id }), "课节已停用");
    if (result.ok) setDeleteTarget(null);
  }

  const listView = (
    <>
      <PageHeader
        eyebrow="课程体系"
        title={t("operator.courseTree")}
        description="按科目维护课程与课节，保存后即可用于排课。"
      />

      <div className="course-catalog-layout">
        <aside className="course-subject-rail" aria-label="科目筛选">
          <div className="course-subject-rail-head">
            <button type="button" className={selectedSubjectId === "all" ? "course-subject-item active" : "course-subject-item"} onClick={() => setSelectedSubjectId("all")}>
              <span>全部科目</span><small>{state.folders.length}</small>
            </button>
            <Button className="course-subject-create" size="icon" variant="secondary" aria-label="新增科目" title="新增科目" onClick={() => setSubjectEditor("new")}><Plus size={15} /></Button>
          </div>
          {subjects.map((subject) => (
            <div key={subject.id} className={`course-subject-item-wrap${subject.id === selectedSubjectId ? " active" : ""}`}>
              <button type="button" className={subject.id === selectedSubjectId ? "course-subject-item active" : "course-subject-item"} onClick={() => setSelectedSubjectId(subject.id)}>
                <span className="course-subject-name"><i style={{ background: subject.color }} />{subject.name}</span>
              </button>
              <div className="course-subject-actions">
                <button type="button" className="course-subject-action is-edit" aria-label={`编辑科目 ${subject.name}`} onClick={() => setSubjectEditor(subject.id)}>
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="course-subject-action is-delete"
                  aria-label={`删除科目 ${subject.name}`}
                  onClick={() => {
                    const courseCount = countCourses(subject.id);
                    if (courseCount > 0) setSubjectDeleteNotice({ name: subject.name, courseCount });
                    else setDeleteTarget({ kind: "subject", id: subject.id, label: subject.name });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {subjects.length === 0 && <p className="course-subject-empty">还没有科目</p>}
        </aside>

        <section className="course-catalog-main">
          <div className="course-catalog-filters">
            <div className="search-box wide">
              <Search size={17} />
              <TextInput aria-label="搜索课程" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索课程名称、说明或标签" />
            </div>
            <Button className="course-catalog-create" size="sm" variant="secondary" disabled={subjects.length === 0} onClick={() => setCourseEditor("new")}><Plus size={14} /> 新建课程</Button>
          </div>

          {subjects.length === 0 ? (
            <EmptyState title="先创建第一个科目" description="科目是课程的上层分类，例如中文、英语或数学。" action={<Button onClick={() => setSubjectEditor("new")}><Plus size={17} /> 新增科目</Button>} />
          ) : visibleCourses.length === 0 ? (
            <EmptyState
              title={subjectCourses.length === 0 ? "当前科目还没有课程" : "没有符合条件的课程"}
              description={subjectCourses.length === 0 ? "创建课程后，在课程卡片内添加课节。" : "换个搜索词再试。"}
              action={subjectCourses.length === 0 ? <Button onClick={() => setCourseEditor("new")}><Plus size={17} /> 新建课程</Button> : undefined}
            />
          ) : (
            <div className="course-catalog-table">
              <div className="course-catalog-table-head" aria-hidden="true">
                <span />
                <span>课程</span>
                <span>科目</span>
                <span>课节</span>
                <span>操作</span>
              </div>
              <div className="course-catalog-list">
                {visibleCourses.map((course) => {
                const lessons = state.lessons.filter((lesson) => lesson.folderId === course.id).sort((a, b) => a.order - b.order);
                const isExpanded = expandedCourseIds.has(course.id);
                return (
                  <article key={course.id} className={`course-list-row${isExpanded ? " is-open" : ""}`}>
                    <div className="course-list-summary">
                      <button
                        type="button"
                        className="course-list-toggle"
                        onClick={() => setExpandedCourseIds((current) => {
                          const next = new Set(current);
                          if (next.has(course.id)) next.delete(course.id);
                          else next.add(course.id);
                          return next;
                        })}
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
                        <span className="course-list-lessons">{lessons.length}</span>
                      </button>
                      <div className="course-list-actions">
                        <details className="course-row-menu">
                          <summary aria-label={`更多课程操作 ${course.name}`}><MoreHorizontal size={16} /></summary>
                          <div className="course-row-menu-popover" role="menu">
                            <button type="button" role="menuitem" onClick={(event) => { closeDetailsMenu(event); setCourseEditor(course.id); }}>
                              <Pencil size={14} /> 编辑课程
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="danger-ghost"
                              title="删除课程"
                              onClick={(event) => { closeDetailsMenu(event); setDeleteTarget({ kind: "course", id: course.id, label: course.name }); }}
                            >
                              <Trash2 size={14} /> 删除课程
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>

                    {isExpanded && (
                      <section className="course-card-expanded" id={`course-lessons-${course.id}`} aria-label={`${course.name}的课节`}>
                        {lessons.length === 0 ? (
                          <div className="course-lesson-empty">
                            <BookOpen size={18} />
                            <div><strong>还没有课节</strong><p>先添加一个课节。</p></div>
                            <Button className="course-lesson-add-inline" size="sm" variant="primary" aria-label={`新建课节 ${course.name}`} onClick={() => setLessonEditor({ courseId: course.id })}><Plus size={15} /> 添加课节</Button>
                          </div>
                        ) : (
                          <>
                          <div className="course-lesson-group">
                          <div className="course-lesson-toolbar">
                            <span className="course-lesson-toolbar-title">课节</span>
                            <Button className="course-lesson-add-inline" size="sm" variant="primary" aria-label={`新建课节 ${course.name}`} onClick={() => setLessonEditor({ courseId: course.id })}>
                              <Plus size={14} /> 添加课节
                            </Button>
                          </div>
                          <div className="course-lesson-table">
                            {lessons.map((lesson, index) => {
                              return (
                                <div
                                  className={`course-lesson-table-row${draggingLessonId === lesson.id ? " is-dragging" : ""}${dragOverLessonId === lesson.id ? " is-drag-over" : ""}`}
                                  key={lesson.id}
                                  onDragOver={(event) => {
                                    if (!draggingLessonId || draggingLessonId === lesson.id) return;
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";
                                    if (dragOverLessonId !== lesson.id) setDragOverLessonId(lesson.id);
                                  }}
                                  onDragLeave={(event) => {
                                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverLessonId(null);
                                  }}
                                  onDrop={(event) => dropLesson(event, lessons, index)}
                                >
                                  <button
                                    type="button"
                                    className="course-lesson-table-order"
                                    draggable
                                    aria-label={`调整课节顺序 ${lesson.title}`}
                                    title="拖动调整顺序，或用上下方向键"
                                    onDragStart={(event) => startLessonDrag(event, lesson.id)}
                                    onDragEnd={finishLessonDrag}
                                    onKeyDown={(event) => reorderLessonWithKeyboard(event, lessons, index)}
                                  >
                                    <GripVertical size={13} aria-hidden="true" />
                                    <span>{String(index + 1).padStart(2, "0")}</span>
                                  </button>
                                  <div className="course-lesson-table-title">
                                    <strong>{lesson.title}</strong>
                                  </div>
                                  <span className="course-lesson-table-duration">{lesson.durationMinutes} 分钟</span>
                                  <div className="course-lesson-table-actions">
                                    <button
                                      type="button"
                                      className="course-lesson-row-action"
                                      aria-label={`编辑课节 ${lesson.title}`}
                                      title="编辑课节"
                                      onClick={() => setLessonEditor({ courseId: course.id, lesson })}
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="course-lesson-row-action is-danger"
                                      aria-label={`删除课节 ${lesson.title}`}
                                      title="删除课节"
                                      onClick={() => setDeleteTarget({ kind: "lesson", id: lesson.id, label: lesson.title })}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          </div>
                          </>
                        )}
                      </section>
                    )}
                  </article>
                );
                })}
              </div>
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
            setExpandedCourseIds((current) => new Set(current).add(course.id));
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

      {deleteTarget && (() => {
        const itemLabel = deleteTarget.kind === "course" ? "课程" : deleteTarget.kind === "lesson" ? "课节" : "科目";
        const references = deleteTarget.kind === "course"
          ? courseReferences(state, deleteTarget.id)
          : deleteTarget.kind === "lesson"
            ? lessonReferences(state, deleteTarget.id)
            : null;
        const blockedByReferences = references !== null && referenceCount(references) > 0;
        const targetStatus = deleteTarget.kind === "course"
          ? state.folders.find((course) => course.id === deleteTarget.id)?.status
          : deleteTarget.kind === "lesson"
            ? state.lessons.find((lesson) => lesson.id === deleteTarget.id)?.status
            : undefined;
        const alreadyDisabled = targetStatus === "disabled";
        const referenceRows = references
          ? [
              { label: "排课课次", count: references.sessions },
              { label: "课程系列", count: references.series },
              { label: "互动内容", count: references.interactions },
              { label: "学习资料", count: references.materials }
            ].filter((item) => item.count > 0)
          : [];

        return (
          <Modal
            open
            title={blockedByReferences ? `无法删除${itemLabel}` : `删除${itemLabel}`}
            onClose={() => setDeleteTarget(null)}
            footer={blockedByReferences ? (
              <div className="modal-footer-split">
                <small>停用后可恢复，历史记录不会改变。</small>
                <div>
                  <Button variant="ghost" onClick={() => setDeleteTarget(null)}>取消</Button>
                  <Button disabled={alreadyDisabled} onClick={stopDeleteTarget}>{alreadyDisabled ? `${itemLabel}已停用` : `停用${itemLabel}`}</Button>
                </div>
              </div>
            ) : (
              <div className="modal-footer-split">
                <small>该操作不可恢复。</small>
                <div><Button variant="ghost" onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="danger" onClick={confirmDelete}>确认删除</Button></div>
              </div>
            )}
          >
            {blockedByReferences ? (
              <>
                <div className="subject-delete-message">
                  <span className="subject-delete-icon"><TriangleAlert size={20} /></span>
                  <div>
                    <strong>「{deleteTarget.label}」正在被使用</strong>
                    <p>系统需要保留已有课次与学习记录，因此不能直接删除。</p>
                  </div>
                </div>
                <div className="catalog-reference-grid" aria-label="引用统计">
                  {referenceRows.map((item) => <span key={item.label}><strong>{item.count}</strong> {item.label}</span>)}
                </div>
                <p className="muted-copy">可以先停用{itemLabel}。停用后不会被后续排课选用，也不会从课程目录中消失。</p>
              </>
            ) : (
              <>
                <p>{`确定删除“${deleteTarget.label}”吗？`}</p>
                <p className="muted-copy">删除后不可恢复。</p>
              </>
            )}
          </Modal>
        );
      })()}

      {subjectDeleteNotice && (
        <Modal
          open
          title="无法删除科目"
          onClose={() => setSubjectDeleteNotice(null)}
          footer={<div className="modal-footer-split"><span /><div><Button onClick={() => setSubjectDeleteNotice(null)}>知道了</Button></div></div>}
        >
          <div className="subject-delete-message">
            <span className="subject-delete-icon"><TriangleAlert size={20} /></span>
            <div>
              <strong>「{subjectDeleteNotice.name}」下还有 {subjectDeleteNotice.courseCount} 门课程</strong>
              <p>请先移走或删除这些课程，再删除科目。</p>
            </div>
          </div>
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
    description: subject?.description ?? ""
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
            ) : <small>科目只负责分类。</small>}
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
    tags: course?.tags.join("，") ?? ""
  });

  function save() {
    const payload = {
      subjectId: form.subjectId,
      name: form.name,
      description: form.description,
      tags: parseTags(form.tags),
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
      footer={<div className="modal-footer-split"><small>{course ? "修改保存后立即生效。" : "先创建课程，再添加课节；有课节后即可排课。"}</small><div><Button variant="ghost" onClick={onClose}>取消</Button><Button disabled={!form.name.trim() || !form.subjectId} onClick={save}>{course ? "保存课程" : "创建课程"}</Button></div></div>}
    >
      <div className="editor-grid">
        <Field label="所属科目"><Select value={form.subjectId} onChange={(event) => setForm((value) => ({ ...value, subjectId: event.target.value }))}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</Select></Field>
        <Field label="课程名称"><TextInput value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="例如：校园与生活" /></Field>
        <Field label="课程说明" className="field-span-2"><textarea className="input textarea" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="说明课程内容和使用范围" /></Field>
        <Field label="标签" className="field-span-2" hint="用逗号分隔，例如：入门，口语，校园"><TextInput value={form.tags} onChange={(event) => setForm((value) => ({ ...value, tags: event.target.value }))} /></Field>
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
    tags: lesson?.tags.join("，") ?? ""
  });

  function save() {
    const payload = {
      title: form.title,
      subtitle: form.subtitle,
      description: form.description,
      durationMinutes: Number(form.durationMinutes) || 40,
      tags: parseTags(form.tags)
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
      footer={<div className="modal-footer-split"><small>{lesson ? `所属课程：${course.name}` : `将创建在“${course.name}”下，保存后即可排课。`}</small><div><Button variant="ghost" onClick={onClose}>取消</Button><Button disabled={!form.title.trim()} onClick={save}>{lesson ? "保存课节" : "创建课节"}</Button></div></div>}
    >
      <div className="editor-grid">
        <Field label="课节标题" className="field-span-2"><TextInput value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="例如：认识新朋友" /></Field>
        <Field label="副标题 / 印尼语" className="field-span-2"><TextInput value={form.subtitle} onChange={(event) => setForm((value) => ({ ...value, subtitle: event.target.value }))} /></Field>
        <Field label="课节说明" className="field-span-2"><textarea className="input textarea" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></Field>
        <Field label="时长（分钟）"><TextInput type="number" min={1} value={form.durationMinutes} onChange={(event) => setForm((value) => ({ ...value, durationMinutes: Number(event.target.value) }))} /></Field>
        <Field label="课节标签" hint="用逗号分隔"><TextInput value={form.tags} onChange={(event) => setForm((value) => ({ ...value, tags: event.target.value }))} /></Field>
      </div>
    </Modal>
  );
}
