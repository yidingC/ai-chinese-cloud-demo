import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Archive, Building2, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Search, Trash2, UserRoundPlus, UsersRound } from "lucide-react";
import type { ClassGroup, GradeCategory } from "../../domain/types";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, ProgressBar, Select, Tabs, TextInput } from "../../components/ui";
import { currentUser, getUser, studentAppAccount } from "../../lib/domain";
import { getAcademicSchoolId, workspaceState } from "../../lib/academicScope";
import { dateInputInTimeZone, gradeRangeBounds, selectGradePolicy } from "../../lib/gradeAnalytics";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";

type StudentManagementTab = "students" | "classes";
const gradeCategories: GradeCategory[] = ["interaction", "homework", "exam"];
const gradeLabels: Record<GradeCategory, string> = { interaction: "互动练习", homework: "作业", exam: "考试" };

export function OperatorStudents({
  academic = false,
  basePath = "/operator"
}: {
  academic?: boolean;
  basePath?: string;
} = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state: rawState, run } = usePlatformStore();
  const operator = currentUser(rawState);
  const activeSchools = useMemo(() => rawState.schools.filter((item) => item.status === "active"), [rawState.schools]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(() => {
    const requestedSchoolId = searchParams.get("school") ?? "";
    return activeSchools.some((school) => school.id === requestedSchoolId)
      ? requestedSchoolId
      : activeSchools[0]?.id ?? "";
  });
  const schoolId = academic ? getAcademicSchoolId(rawState, operator) : selectedSchoolId;
  const state = useMemo(() => workspaceState(rawState, schoolId), [rawState, schoolId]);
  const selectedSchool = rawState.schools.find((item) => item.id === schoolId) ?? null;
  const [tab, setTab] = useState<StudentManagementTab>(() => searchParams.get("tab") === "students" ? "students" : "classes");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [classEditor, setClassEditor] = useState<ClassGroup | "new" | null>(null);
  const [memberClassId, setMemberClassId] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    timeZone: "Asia/Jakarta",
    locale: "id-ID",
    program: "Mandarin Explorer",
    level: "初级 1",
    learningGoal: "",
    preferredTeacherId: ""
  });

  function activeClassNames(studentId: string) {
    const names = new Set<string>();
    state.classEnrollments.forEach((enrollment) => {
      if (enrollment.studentId !== studentId || enrollment.status !== "active") return;
      const classItem = state.classes.find((item) => item.id === enrollment.classId);
      if (classItem?.status === "active" && classItem.name !== "待分班") names.add(classItem.name);
    });
    return [...names];
  }

  const students = state.students.filter((profile) => {
    const user = getUser(state, profile.userId);
    const classNames = activeClassNames(profile.userId);
    const keyword = query.trim().toLowerCase();
    return !keyword || `${user?.name ?? ""} ${profile.level} ${classNames.join(" ")} ${profile.tags.join(" ")}`.toLowerCase().includes(keyword);
  });

  function createStudent() {
    if (!schoolId) return;
    const result = run(
      () => platform.createStudent({ ...form, schoolId, actorId: operator.id }),
      "学生档案已创建"
    );
    if (result.ok) {
      setCreateOpen(false);
      setForm((value) => ({ ...value, name: "", phone: "", learningGoal: "" }));
    }
  }

  return (
    <>
      {!academic && searchParams.get("from") === "schools" && (
        <Button className="detail-back-button" variant="ghost" onClick={() => navigate("/operator/schools")}>
          <ChevronLeft size={18} /> 返回学校与教职工
        </Button>
      )}
      <PageHeader
        eyebrow="Student operations"
        title={academic ? "本校班级与学生" : "班级与学生"}
        description={academic ? "以班级为单位维护本校名单与教师；需要查找个人时切换到学生档案。班级名称和成员变化不会拆分历史成绩。" : "以班级为单位维护名单与教师；需要查找个人时切换到学生档案。学校决定班级范围和可选教师，历史成绩不会因班级调整而拆分。"}
      />

      <Card className="student-management-toolbar">
        <div className="student-management-school">
          <Building2 size={16} aria-hidden="true" />
          {academic ? (
            <span className="student-management-school-fixed">
              <strong>{selectedSchool?.name ?? "未绑定学校"}</strong>
              {selectedSchool?.code && <small>{selectedSchool.code}</small>}
            </span>
          ) : (
            <Select
              aria-label="当前学校"
              className="student-management-school-select"
              value={schoolId}
              onChange={(event) => {
                const nextSchoolId = event.target.value;
                setSelectedSchoolId(nextSchoolId);
                setQuery("");
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set("school", nextSchoolId);
                setSearchParams(nextParams, { replace: true });
              }}
            >
              {activeSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </Select>
          )}
        </div>
        <span className="student-management-toolbar-divider" aria-hidden="true" />
        <Tabs
          value={tab}
          onChange={(nextTab) => {
            setTab(nextTab);
            setQuery("");
            const nextParams = new URLSearchParams(searchParams);
            if (nextTab === "students") nextParams.set("tab", "students");
            else nextParams.delete("tab");
            setSearchParams(nextParams, { replace: true });
          }}
          items={[
            { value: "classes", label: "班级与学生" },
            { value: "students", label: "学生档案" }
          ]}
        />
        <div className="student-management-toolbar-actions">
          <div className="search-box">
            <Search size={17} />
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === "classes" ? "搜索班级名称" : "搜索姓名、等级、班级或标签"}
              disabled={!schoolId}
            />
          </div>
          {tab === "students"
            ? <Button disabled={!schoolId} onClick={() => setCreateOpen(true)}><UserRoundPlus size={17} /> 新建学生</Button>
            : <Button disabled={!schoolId} onClick={() => setClassEditor("new")}><Plus size={17} /> 新建班级</Button>}
        </div>
      </Card>

      {tab === "students" && (
        <>
          {students.length > 0 && (
            <Card className="student-roster-table">
              <div className="student-roster-list">
                {students.map((profile) => {
                  const user = getUser(state, profile.userId);
                  if (!user) return null;
                  const classNames = activeClassNames(profile.userId);
                  const visibleTags = profile.tags.slice(0, 2);
                  const hiddenTagCount = profile.tags.length - visibleTags.length;
                  return (
                    <article className="student-roster-row" key={profile.userId}>
                      <div className="student-roster-person">
                        <Avatar label={user.avatar} tone="purple" />
                        <div>
                          <strong>{user.name}</strong>
                        </div>
                      </div>
                      <div className="student-roster-class"><UsersRound size={14} /> {classNames.length ? classNames.join("、") : "待分班"}</div>
                      <div className="student-roster-tags">
                        {visibleTags.map((tag) => <span key={tag}>{tag}</span>)}
                        {hiddenTagCount > 0 && <span>+{hiddenTagCount}</span>}
                        {profile.tags.length === 0 && <span className="student-roster-tag-empty">暂无标签</span>}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => navigate(`${basePath}/students/${profile.userId}`)}>
                        查看完整档案 <ChevronRight size={15} />
                      </Button>
                    </article>
                  );
                })}
              </div>
            </Card>
          )}
          {students.length === 0 && <EmptyState title="没有匹配学生" />}
        </>
      )}

      {tab === "classes" && (
        <ClassManagement
          query={query}
          onEdit={setClassEditor}
          onMembers={setMemberClassId}
          schoolId={schoolId}
        />
      )}

      <Modal
        open={createOpen}
        title="新建学生档案"
        onClose={() => setCreateOpen(false)}
        width="720px"
        footer={<div className="modal-footer-split"><small>使用虚构演示信息，不接入真实身份系统</small><div><Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={createStudent}>创建档案</Button></div></div>}
      >
        <div className="editor-grid">
          <Field label="学生姓名" className="field-span-2"><TextInput value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="例如：Nadia" /></Field>
          <Field label="所属学校"><TextInput value={selectedSchool?.name ?? "未选择学校"} readOnly /></Field>
          <Field label="联系方式"><TextInput value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} placeholder="+62 ..." /></Field>
          <Field label="界面语言"><Select value={form.locale} onChange={(event) => setForm((value) => ({ ...value, locale: event.target.value }))}><option value="id-ID">Bahasa Indonesia</option><option value="zh-CN">简体中文</option></Select></Field>
          <Field label="时区"><Select value={form.timeZone} onChange={(event) => setForm((value) => ({ ...value, timeZone: event.target.value }))}><option value="Asia/Jakarta">GMT+7 雅加达</option><option value="Asia/Shanghai">GMT+8 上海</option><option value="Asia/Singapore">GMT+8 新加坡</option></Select></Field>
          <Field label="课程项目"><TextInput value={form.program} onChange={(event) => setForm((value) => ({ ...value, program: event.target.value }))} /></Field>
          <Field label="当前等级"><TextInput value={form.level} onChange={(event) => setForm((value) => ({ ...value, level: event.target.value }))} /></Field>
          <Field label="偏好教师"><Select value={form.preferredTeacherId} onChange={(event) => setForm((value) => ({ ...value, preferredTeacherId: event.target.value }))}><option value="">暂不指定</option>{state.users.filter((item) => item.role === "teacher").filter((teacher) => state.schoolMemberships.some((membership) => membership.schoolId === schoolId && membership.userId === teacher.id && membership.role === "teacher" && membership.status === "active")).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</Select></Field>
          <Field label="学习目标" className="field-span-2"><textarea className="input textarea" value={form.learningGoal} onChange={(event) => setForm((value) => ({ ...value, learningGoal: event.target.value }))} /></Field>
        </div>
      </Modal>

      <ClassEditorModal classItem={classEditor} onClose={() => setClassEditor(null)} academic={academic} schoolId={schoolId} />
      {memberClassId && <ClassMembersModal classId={memberClassId} onClose={() => setMemberClassId("")} schoolId={schoolId} />}
    </>
  );
}

function ClassManagement({
  query,
  onEdit,
  onMembers,
  schoolId
}: {
  query: string;
  onEdit: (classItem: ClassGroup) => void;
  onMembers: (classId: string) => void;
  schoolId: string;
}) {
  const { state: rawState } = usePlatformStore();
  const state = useMemo(() => workspaceState(rawState, schoolId), [rawState, schoolId]);
  const classes = state.classes.filter((item) => !query || item.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      {classes.length > 0 && (
        <Card className="student-roster-table">
          <div className="student-roster-list">
            {classes.map((classItem) => {
              const teacher = getUser(state, classItem.teacherId);
              const members = state.classEnrollments.filter((item) => item.classId === classItem.id && item.status === "active");
              return (
                <article className="student-roster-row class-roster-row" key={classItem.id}>
                  <div className="class-roster-identity">
                    <strong>{classItem.name}</strong>
                    {classItem.status === "archived" && <Badge tone="neutral">已归档</Badge>}
                  </div>
                  <div className="class-roster-meta">
                    <span>{teacher?.name ?? "未分配教师"}</span>
                    <span>{members.length > 0 ? `${members.length} 名学生` : "尚无学生"}</span>
                  </div>
                  <div className="class-roster-actions">
                    <Button variant="secondary" onClick={() => onMembers(classItem.id)}><UsersRound size={15} /> 管理学生</Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      aria-label={`编辑班级：${classItem.name}`}
                      title="编辑班级"
                      onClick={() => onEdit(classItem)}
                    >
                      <Pencil size={16} />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </Card>
      )}
      {classes.length === 0 && <EmptyState title="没有匹配班级" />}
    </>
  );
}

function ClassEditorModal({
  classItem,
  onClose,
  academic = false,
  schoolId
}: {
  classItem: ClassGroup | "new" | null;
  onClose: () => void;
  academic?: boolean;
  schoolId: string;
}) {
  const { state: rawState, run } = usePlatformStore();
  const actor = currentUser(rawState);
  const state = useMemo(() => workspaceState(rawState, schoolId), [rawState, schoolId]);
  const currentSchool = rawState.schools.find((item) => item.id === schoolId);
  const teachers = state.users.filter((item) => item.role === "teacher");
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!classItem) return;
    setName(classItem === "new" ? "" : classItem.name);
    setTeacherId(classItem === "new" ? teachers[0]?.id ?? "" : classItem.teacherId);
    setConfirmDelete(false);
    // 只在打开或切换班级时重置。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classItem]);

  if (!classItem) return null;
  const currentClass = classItem;
  const classHasHistory = currentClass !== "new" && (
    state.classEnrollments.some((item) => item.classId === currentClass.id)
    || state.sessions.some((item) => item.classId === currentClass.id)
    || state.assessments.some((item) => item.classId === currentClass.id)
    || state.students.some((item) => item.primaryClassId === currentClass.id)
  );
  function save() {
    const result = currentClass === "new"
      ? run(() => platform.createClass({ name, teacherId, schoolId: schoolId || undefined, actorId: actor.id }), "班级已创建")
      : run(() => platform.updateClass({ classId: currentClass.id, patch: { name, teacherId }, actorId: actor.id, reason: academic ? "学校教务维护班级" : "教学管理维护班级" }), "班级已更新");
    if (result.ok) onClose();
  }

  function changeStatus(nextStatus: "active" | "archived") {
    if (currentClass === "new") return;
    const result = run(
      () => platform.updateClass({
        classId: currentClass.id,
        patch: { status: nextStatus },
        actorId: actor.id,
        reason: academic ? "学校教务维护班级状态" : "教学管理维护班级状态"
      }),
      nextStatus === "archived" ? "班级已归档" : "班级已恢复"
    );
    if (result.ok) onClose();
  }

  function removeClass() {
    if (currentClass === "new") return;
    const result = run(() => platform.deleteClass({ classId: currentClass.id, actorId: actor.id }), "空班级已删除");
    if (result.ok) {
      setConfirmDelete(false);
      onClose();
    }
  }

  const lifecycleAction = currentClass === "new"
    ? <small>班级是正式考核名单和教师权限的稳定边界。</small>
    : classHasHistory
      ? (
        <Button
          variant="ghost"
          className="class-lifecycle-action"
          onClick={() => changeStatus(currentClass.status === "active" ? "archived" : "active")}
        >
          {currentClass.status === "active" ? <><Archive size={15} /> 归档班级</> : <><RotateCcw size={15} /> 恢复班级</>}
        </Button>
      )
      : (
        <Button variant="ghost" className="class-lifecycle-action class-lifecycle-action-danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} /> 删除班级
        </Button>
      );

  return (
    <>
      <Modal
        open
        title={classItem === "new" ? "新建班级" : "编辑班级"}
        onClose={onClose}
        footer={<div className="modal-footer-split">{lifecycleAction}<div><Button variant="ghost" onClick={onClose}>取消</Button><Button disabled={!name.trim() || !teacherId || !schoolId} onClick={save}>保存班级</Button></div></div>}
      >
        <div className="editor-grid">
          <Field label="班级名称" className="field-span-2"><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：印尼圣心学校7年级A班" /></Field>
          <Field label="所属学校"><TextInput value={currentSchool?.name ?? "未选择学校"} readOnly /></Field>
          <Field label="主教师"><Select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</Select></Field>
        </div>
      </Modal>
      <Modal
        open={confirmDelete}
        title="删除空班级"
        onClose={() => setConfirmDelete(false)}
        width="440px"
        footer={<div className="modal-footer-split modal-footer-end"><div><Button variant="ghost" onClick={() => setConfirmDelete(false)}>取消</Button><Button variant="danger" onClick={removeClass}>永久删除</Button></div></div>}
      >
        <p>确定删除“{currentClass === "new" ? "" : currentClass.name}”吗？</p>
        <p className="muted-copy">该班级没有学生、课次或成绩记录，删除后不可恢复。</p>
      </Modal>
    </>
  );
}

function ClassMembersModal({ classId, onClose, schoolId }: { classId: string; onClose: () => void; schoolId: string }) {
  const { state: rawState, run } = usePlatformStore();
  const actor = currentUser(rawState);
  const state = useMemo(() => workspaceState(rawState, schoolId), [rawState, schoolId]);
  const classItem = state.classes.find((item) => item.id === classId);
  const activeIds = state.classEnrollments.filter((item) => item.classId === classId && item.status === "active").map((item) => item.studentId);
  const [view, setView] = useState<"roster" | "add">("roster");
  const [memberQuery, setMemberQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmRemoveId, setConfirmRemoveId] = useState("");

  function activeClassNames(studentId: string) {
    const names = new Set<string>();
    state.classEnrollments.forEach((enrollment) => {
      if (enrollment.studentId !== studentId || enrollment.status !== "active") return;
      const item = state.classes.find((candidate) => candidate.id === enrollment.classId);
      if (item?.status === "active" && item.name !== "待分班") names.add(item.name);
    });
    return [...names];
  }

  const memberIds = new Set(activeIds);
  const members = state.classEnrollments.flatMap((enrollment) => {
    if (enrollment.classId !== classId || enrollment.status !== "active") return [];
    const user = getUser(state, enrollment.studentId);
    const profile = state.students.find((item) => item.userId === enrollment.studentId);
    return user && profile ? [{ enrollment, user, profile }] : [];
  });
  const memberKeyword = memberQuery.trim().toLowerCase();
  const visibleMembers = members.filter(({ user, profile }) => {
    if (!memberKeyword) return true;
    return `${user.name} ${user.phone ?? ""} ${studentAppAccount(user)} ${profile.level}`.toLowerCase().includes(memberKeyword);
  });
  const unboundCount = members.filter(({ user }) => !studentAppAccount(user)).length;

  const addKeyword = addQuery.trim().toLowerCase();
  const candidates = state.students.flatMap((profile) => {
    if (memberIds.has(profile.userId)) return [];
    const user = getUser(state, profile.userId);
    if (!user) return [];
    const account = studentAppAccount(user);
    const classNames = activeClassNames(profile.userId);
    const text = `${user.name} ${user.phone ?? ""} ${account} ${profile.level} ${classNames.join(" ")}`.toLowerCase();
    if (addKeyword && !text.includes(addKeyword)) return [];
    return [{ profile, user, account, classNames }];
  }).sort((a, b) => a.user.name.localeCompare(b.user.name));

  const pendingRemoval = members.find(({ user }) => user.id === confirmRemoveId);
  const pendingOtherClasses = pendingRemoval
    ? activeClassNames(pendingRemoval.user.id).filter((name) => name !== classItem?.name)
    : [];

  function openAddView() {
    setView("add");
    setSelected(new Set());
    setAddQuery("");
    setConfirmRemoveId("");
  }

  function backToRoster() {
    setView("roster");
    setSelected(new Set());
    setAddQuery("");
  }

  function toggle(studentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }

  function addSelected() {
    if (selected.size === 0) return;
    const studentIds = [...selected];
    const result = run(
      () => platform.addClassMembers({ classId, studentIds, actorId: actor.id }),
      `已加入 ${studentIds.length} 名学生`
    );
    if (result.ok) {
      setMemberQuery("");
      backToRoster();
    }
  }

  function removeMember() {
    if (!confirmRemoveId) return;
    const result = run(
      () => platform.removeClassMember({ classId, studentId: confirmRemoveId, actorId: actor.id }),
      "已移出本班"
    );
    if (result.ok) setConfirmRemoveId("");
  }

  return (
    <Modal
      open
      title={view === "roster" ? `学生名单 · ${classItem?.name ?? "班级"}` : `添加学生 · ${classItem?.name ?? "班级"}`}
      onClose={onClose}
      width="860px"
      footer={view === "roster" ? (
        <div className="modal-footer-split modal-footer-end">
          <div><Button variant="ghost" onClick={onClose}>完成</Button></div>
        </div>
      ) : (
        <div className="modal-footer-split modal-footer-end">
          <div>
            <Button variant="ghost" onClick={backToRoster}>取消</Button>
            <Button disabled={selected.size === 0} onClick={addSelected}>
              {selected.size > 0 ? `加入 ${selected.size} 名学生` : "加入学生"}
            </Button>
          </div>
        </div>
      )}
    >
      {view === "roster" ? (
        <>
          <div className="class-roster-toolbar">
            <div className="class-roster-summary">
              <span>本班共 <strong>{members.length}</strong> 名学生</span>
              <span className={unboundCount > 0 ? "is-unbound" : ""}>{unboundCount} 人未绑定 App</span>
            </div>
            <div className="search-box class-member-search">
              <Search size={16} />
              <TextInput value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="搜索本班姓名、手机号或 App 账号" />
            </div>
            <Button variant="secondary" onClick={openAddView}><UserRoundPlus size={17} /> 添加学生</Button>
          </div>

          {pendingRemoval && (
            <div className="class-remove-confirm">
              <div>
                <strong>将 {pendingRemoval.user.name} 移出本班？</strong>
                <small>{pendingOtherClasses.length > 0 ? `该学生仍保留在“${pendingOtherClasses.join("、")}”。` : "移出后该学生将显示为“待分班”。"}</small>
              </div>
              <div>
                <Button size="sm" variant="ghost" onClick={() => setConfirmRemoveId("")}>取消</Button>
                <Button size="sm" variant="danger" onClick={removeMember}>确认移出</Button>
              </div>
            </div>
          )}

          {visibleMembers.length > 0 && (
            <div className="class-roster-table">
              <div className="class-roster-table-head">
                <span>姓名 / 等级</span>
                <span>手机号</span>
                <span>App 绑定</span>
              </div>
              {visibleMembers.map(({ user, profile }) => {
                const account = studentAppAccount(user);
                return (
                  <div className="class-roster-member-row" key={user.id}>
                    <div className="class-roster-person">
                      <Avatar label={user.avatar} size="sm" tone="purple" />
                      <span><strong>{user.name}</strong><small>{profile.level}</small></span>
                    </div>
                    <span className="class-roster-phone">{user.phone || "未填写"}</span>
                    <div className="class-roster-binding">
                      {account ? <Badge tone="mint">已绑定</Badge> : <Badge tone="danger">未绑定</Badge>}
                    </div>
                    <div className="class-roster-row-action">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemoveId(user.id)}>移出</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {members.length === 0 && <EmptyState title="这个班还没有学生" action={<Button onClick={openAddView}>添加学生</Button>} />}
          {members.length > 0 && visibleMembers.length === 0 && <EmptyState title="本班没有匹配的学生" />}
        </>
      ) : (
        <>
          <div className="class-add-toolbar">
            <Button size="sm" variant="ghost" onClick={backToRoster}><ChevronLeft size={15} /> 返回名单</Button>
            <div className="search-box wide class-member-search">
              <Search size={16} />
              <TextInput value={addQuery} onChange={(event) => setAddQuery(event.target.value)} placeholder="搜索姓名、手机号或 App 账号" />
            </div>
          </div>
          {candidates.length > 0 && (
            <div className="class-add-list">
              {candidates.map(({ user, profile, account, classNames }) => {
                const checked = selected.has(user.id);
                const classHint = classNames.length === 0
                  ? "待分班"
                  : classNames.length === 1
                    ? `已在「${classNames[0]}」`
                    : `已在 ${classNames.length} 个班`;
                return (
                  <label className={`class-add-row ${checked ? "is-selected" : ""}`} key={user.id}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(user.id)} />
                    <Avatar label={user.avatar} size="sm" tone={checked ? "purple" : "neutral"} />
                    <span className="class-add-person">
                      <strong>{user.name}</strong>
                      <small>{profile.level} · {classHint}</small>
                    </span>
                    <span className="class-add-binding">
                      {account ? <Badge tone="mint">已绑定</Badge> : <Badge tone="danger">未绑定</Badge>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {candidates.length === 0 && <EmptyState title={addQuery ? "没有匹配的学生" : "没有可添加的学生"} />}
        </>
      )}
    </Modal>
  );
}

export function GradeRuleSettings({ academic = false, schoolId = "" }: { academic?: boolean; schoolId?: string }) {
  const { state: rawState, run } = usePlatformStore();
  const operator = currentUser(rawState);
  const state = useMemo(
    () => (academic ? workspaceState(rawState, schoolId) : rawState),
    [academic, rawState, schoolId]
  );
  const policySchoolId = academic ? schoolId : null;
  const currentPolicy = selectGradePolicy(state, new Date().toISOString(), policySchoolId);
  const [weights, setWeights] = useState(currentPolicy.weights);
  const [effectiveFrom, setEffectiveFrom] = useState(dateInputInTimeZone(new Date(), state.ui.timeZone));
  const total = gradeCategories.reduce((sum, category) => sum + Number(weights[category] || 0), 0);
  const history = useMemo(
    () => [...state.gradePolicies].filter((item) => item.schoolId === policySchoolId).sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()),
    [policySchoolId, state.gradePolicies]
  );

  function save() {
    const effectiveAt = gradeRangeBounds({ start: effectiveFrom, end: effectiveFrom, timeZone: state.ui.timeZone }).startAt;
    run(() => platform.saveGradePolicy({ effectiveFrom: effectiveAt, weights, schoolId: policySchoolId, actorId: operator.id }), academic ? "本校成绩权重已更新" : "平台默认成绩权重已更新");
  }

  return (
    <div className="grade-rule-layout">
      <Card className="grade-rule-editor">
        <div className="card-heading"><div><span className="eyebrow">Weighting</span><h2>{academic ? "本校综合成绩权重" : "平台默认综合成绩权重"}</h2></div><Badge tone={total === 100 ? "mint" : "danger"}>合计 {total}%</Badge></div>
        <p>权重按生效日期分版本。统计区间跨过生效日时，整个区间使用区间末期最新政策。</p>
        <div className="grade-rule-fields">
          {gradeCategories.map((category) => (
            <Field label={gradeLabels[category]} key={category}>
              <TextInput type="number" min="0" max="100" value={weights[category]} onChange={(event) => setWeights((current) => ({ ...current, [category]: Number(event.target.value) }))} />
            </Field>
          ))}
          <Field label="生效日期"><TextInput type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></Field>
        </div>
        <div className="grade-rule-preview">
          {gradeCategories.map((category) => <div key={category}><ProgressBar value={weights[category]} tone={category === "interaction" ? "mint" : category === "homework" ? "orange" : "blue"} /><span>{gradeLabels[category]} {weights[category]}%</span></div>)}
        </div>
        <Button disabled={total !== 100} onClick={save}>保存新权重版本</Button>
      </Card>
      <Card className="grade-policy-history">
        <div className="card-heading"><div><span className="eyebrow">History</span><h2>政策历史</h2></div></div>
        <div className="grade-policy-list">
          {history.map((policy) => (
            <article key={policy.id}>
              <div><strong>{formatPolicyDate(policy.effectiveFrom, state.ui.timeZone)}</strong><Badge tone={policy.id === currentPolicy.id ? "mint" : "neutral"}>{policy.id === currentPolicy.id ? "当前生效" : "历史"}</Badge></div>
              <p>互动 {policy.weights.interaction}% · 作业 {policy.weights.homework}% · 考试 {policy.weights.exam}%</p>
              <small>{getUser(state, policy.updatedBy)?.name ?? policy.updatedBy}</small>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

function formatPolicyDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
