import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ChevronRight, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2, UserMinus, UserPlus, UserRoundPlus, UsersRound } from "lucide-react";
import type { PlatformState, PlatformUser, School, SchoolRole } from "../../domain/types";
import { Avatar, Button, Card, EmptyState, Field, Modal, PageHeader, Select, TextInput } from "../../components/ui";
import { currentUser, getUser } from "../../lib/domain";
import { timeZoneLabel } from "../../lib/format";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";

type StaffRole = Exclude<SchoolRole, "student">;
type SchoolStatusFilter = "all" | School["status"];
type SchoolLifecycleAction = "archive" | "delete";
type PendingSchoolLifecycle = { school: School; action: SchoolLifecycleAction };

const staffRoleLabels: Record<StaffRole, string> = {
  academic: "教务",
  teacher: "教师"
};

const timeZoneOptions = [
  { value: "Asia/Jakarta", label: "GMT+7 雅加达" },
  { value: "Asia/Shanghai", label: "GMT+8 上海" },
  { value: "Asia/Singapore", label: "GMT+8 新加坡" }
];

const countryCodeOptions = [
  { value: "+62", label: "+62 印尼" },
  { value: "+86", label: "+86 中国" },
  { value: "+65", label: "+65 新加坡" }
];

function isStaffRole(role: string): role is StaffRole {
  return role === "academic" || role === "teacher";
}

function schoolHasDependencies(state: PlatformState, schoolId: string) {
  return state.schoolMemberships.some((item) => item.schoolId === schoolId)
    || state.classes.some((item) => item.schoolId === schoolId)
    || state.sessions.some((item) => item.schoolId === schoolId)
    || state.series.some((item) => item.schoolId === schoolId)
    || state.assessments.some((item) => item.schoolId === schoolId)
    || state.gradePolicies.some((item) => item.schoolId === schoolId);
}

function schoolMarkTone(code: string) {
  const tones = ["violet", "mint", "amber", "blue"] as const;
  const hash = Array.from(code.toUpperCase()).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0
  );
  return tones[hash % tones.length];
}

export function OperatorSchools() {
  const navigate = useNavigate();
  const { state, run } = usePlatformStore();
  const operator = currentUser(state);
  const [editor, setEditor] = useState<School | "new" | null>(null);
  const [memberSchoolId, setMemberSchoolId] = useState("");
  const [pendingLifecycle, setPendingLifecycle] = useState<PendingSchoolLifecycle | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SchoolStatusFilter>("active");

  const filteredSchools = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return state.schools.filter((school) => {
      if (statusFilter !== "all" && school.status !== statusFilter) return false;
      if (!keyword) return true;
      return `${school.name} ${school.code}`.toLowerCase().includes(keyword);
    });
  }, [query, state.schools, statusFilter]);

  return (
    <>
      <PageHeader
        eyebrow="School operations"
        title="学校与教职工"
        description="维护学校主数据与本校教务、教师。学生名单请到「班级与学生」中维护。"
      />

      <Card className="school-directory-toolbar">
        <div className="search-box school-directory-search">
          <Search size={17} />
          <TextInput
            aria-label="搜索学校"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索学校名称或编码"
          />
        </div>
        <Select
          aria-label="学校状态"
          className="school-directory-status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as SchoolStatusFilter)}
        >
          <option value="active">启用中</option>
          <option value="archived">已停用</option>
          <option value="all">全部学校</option>
        </Select>
        <div className="school-directory-actions">
          <span className="school-directory-count">
            当前 <strong>{filteredSchools.length}</strong> 所学校
          </span>
          <Button onClick={() => setEditor("new")}><Plus size={17} /> 新建学校</Button>
        </div>
      </Card>

      <div className="school-management-grid">
        {filteredSchools.map((school) => {
          const staff = state.schoolMemberships.filter(
            (item) => item.schoolId === school.id && item.status === "active" && isStaffRole(item.role)
          );
          const academics = staff.filter((item) => item.role === "academic");
          const teachers = staff.filter((item) => item.role === "teacher");
          const activeClassCount = state.classes.filter(
            (item) => item.schoolId === school.id && item.status === "active"
          ).length;
          const staffUsers = staff
            .map((membership) => getUser(state, membership.userId))
            .filter((user): user is PlatformUser => Boolean(user));
          const academicNames = academics
            .map((membership) => getUser(state, membership.userId)?.name)
            .filter(Boolean)
            .join("、");
          const teacherNames = teachers
            .map((membership) => getUser(state, membership.userId)?.name)
            .filter(Boolean)
            .join("、");
          const canDelete = !schoolHasDependencies(state, school.id);

          return (
            <Card
              className={`school-management-card${school.status === "archived" ? " is-archived" : ""}`}
              key={school.id}
            >
              <div className="school-card-head">
                <span className={`school-mark school-mark-${schoolMarkTone(school.code)}`} aria-hidden="true">
                  {school.code.slice(0, 2).toUpperCase()}
                </span>
                <div className="school-card-identity">
                  <h2 title={school.name}>{school.name}</h2>
                  <p>{school.code} · {timeZoneLabel(school.timeZone)}</p>
                  <div className="school-card-facts">
                    <span><strong>{academics.length}</strong> 教务</span>
                    <span><strong>{teachers.length}</strong> 教师</span>
                    <span><strong>{activeClassCount}</strong> 进行中班级</span>
                  </div>
                </div>
                {school.status === "archived" && (
                  <span className="school-card-status">
                    <span className="school-card-status-dot" aria-hidden="true" />
                    已停用
                  </span>
                )}
              </div>

              <div className="school-card-team">
                <div className="school-card-team-avatars" aria-hidden="true">
                  {staffUsers.slice(0, 4).map((member) => (
                    <Avatar
                      key={member.id}
                      label={member.avatar}
                      size="sm"
                      tone={member.role === "teacher" ? "orange" : "mint"}
                    />
                  ))}
                  {staffUsers.length > 4 && <span className="school-card-team-more">+{staffUsers.length - 4}</span>}
                </div>
                <div className="school-card-team-copy">
                  <div className="school-card-team-line">
                    <span>教务</span>
                    <strong className={academicNames ? "" : "is-empty"}>{academicNames || "暂无"}</strong>
                  </div>
                  <div className="school-card-team-line">
                    <span>教师</span>
                    <strong className={teacherNames ? "" : "is-empty"}>{teacherNames || "暂无"}</strong>
                  </div>
                </div>
              </div>

              <div className="school-card-actions">
                {school.status === "active" ? (
                  <Button variant="secondary" onClick={() => setMemberSchoolId(school.id)}>
                    <UsersRound size={15} /> 管理教职工
                  </Button>
                ) : (
                  <span className="school-card-archived-note">停用学校暂不可管理</span>
                )}
                <div className="school-card-action-links">
                  {school.status === "active" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/operator/students?school=${school.id}&from=schools`)}
                    >
                      查看班级 <ChevronRight size={14} />
                    </Button>
                  )}
                  <SchoolCardMenu
                    school={school}
                    canDelete={canDelete}
                    onEdit={() => setEditor(school)}
                    onStop={() => setPendingLifecycle({ school, action: "archive" })}
                    onDelete={() => setPendingLifecycle({ school, action: "delete" })}
                    onRestore={() => run(
                      () => platform.updateSchool({ schoolId: school.id, patch: { status: "active" }, actorId: operator.id }),
                      "学校已恢复"
                    )}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {state.schools.length === 0 && (
        <EmptyState title="暂无学校" action={<Button onClick={() => setEditor("new")}>新建学校</Button>} />
      )}
      {state.schools.length > 0 && filteredSchools.length === 0 && (
        <EmptyState
          title="没有匹配的学校"
          action={<Button variant="secondary" onClick={() => { setQuery(""); setStatusFilter("active"); }}>清除筛选</Button>}
        />
      )}

      <SchoolEditorModal item={editor} onClose={() => setEditor(null)} />
      <SchoolLifecycleModal target={pendingLifecycle} onClose={() => setPendingLifecycle(null)} />
      {memberSchoolId && <SchoolMembersModal schoolId={memberSchoolId} onClose={() => setMemberSchoolId("")} />}
    </>
  );
}

function SchoolCardMenu({
  school,
  canDelete,
  onEdit,
  onStop,
  onDelete,
  onRestore
}: {
  school: School;
  canDelete: boolean;
  onEdit: () => void;
  onStop: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="school-card-menu" ref={rootRef}>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`更多学校操作：${school.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="更多学校操作"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={17} />
      </Button>
      {open && (
        <div className="school-card-menu-popover" role="menu" aria-label={`${school.name} · 学校操作`}>
          {school.status === "active" && (
            <>
              <button type="button" role="menuitem" className="school-card-menu-item" onClick={() => choose(onEdit)}>
                <Pencil size={14} /> 编辑学校
              </button>
              <button type="button" role="menuitem" className="school-card-menu-item" onClick={() => choose(onStop)}>
                <Archive size={14} /> 停用学校
              </button>
            </>
          )}
          {school.status === "archived" && (
            <button type="button" role="menuitem" className="school-card-menu-item" onClick={() => choose(onRestore)}>
              <RotateCcw size={14} /> 恢复学校
            </button>
          )}
          {canDelete && (
            <>
              <div className="school-card-menu-separator" role="separator" />
              <button type="button" role="menuitem" className="school-card-menu-item is-danger" onClick={() => choose(onDelete)}>
                <Trash2 size={14} /> 删除学校
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SchoolLifecycleModal({ target, onClose }: { target: PendingSchoolLifecycle | null; onClose: () => void }) {
  const { state, run } = usePlatformStore();
  const operator = currentUser(state);
  if (!target) return null;
  const { school, action } = target;
  const isDelete = action === "delete";
  const activeClassCount = state.classes.filter(
    (item) => item.schoolId === school.id && item.status === "active"
  ).length;

  function confirm() {
    const result = isDelete
      ? run(() => platform.deleteSchool({ schoolId: school.id, actorId: operator.id }), "空学校已删除")
      : run(
        () => platform.updateSchool({ schoolId: school.id, patch: { status: "archived" }, actorId: operator.id }),
        "学校已停用"
      );
    if (result.ok) onClose();
  }

  return (
    <Modal
      open
      title={isDelete ? "删除学校" : "停用学校"}
      onClose={onClose}
      width="460px"
      footer={
        <div className="modal-footer-split modal-footer-end">
          <div>
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button variant={isDelete ? "danger" : "primary"} onClick={confirm}>
              {isDelete ? "永久删除" : "确认停用"}
            </Button>
          </div>
        </div>
      }
    >
      <p>确定{isDelete ? "删除" : "停用"}“{school.name}”吗？</p>
      <p className="muted-copy">
        {isDelete
          ? "该学校没有教职工、班级或课次，删除后不可恢复。"
          : "停用后，学校将从默认列表和排课学校选择中移除；已有班级、课次、成员与历史记录会保留，可随时恢复。"}
      </p>
      {!isDelete && activeClassCount > 0 && (
        <p className="muted-copy">停用不会自动归档班级，该校当前仍有 {activeClassCount} 个进行中班级。</p>
      )}
    </Modal>
  );
}

function SchoolEditorModal({ item, onClose }: { item: School | "new" | null; onClose: () => void }) {
  const { state, run } = usePlatformStore();
  const operator = currentUser(state);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [timeZone, setTimeZone] = useState("Asia/Jakarta");

  useEffect(() => {
    if (!item) return;
    setName(item === "new" ? "" : item.name);
    setCode(item === "new" ? "" : item.code);
    setTimeZone(item === "new" ? "Asia/Jakarta" : item.timeZone);
  }, [item]);

  if (!item) return null;
  const currentItem = item;
  function save() {
    const result = currentItem === "new"
      ? run(() => platform.createSchool({ name, code, timeZone, actorId: operator.id }), "学校已创建")
      : run(() => platform.updateSchool({ schoolId: currentItem.id, patch: { name, code, timeZone }, actorId: operator.id }), "学校已更新");
    if (result.ok) onClose();
  }

  return (
    <Modal open title={item === "new" ? "新建学校" : "编辑学校"} onClose={onClose} footer={<div className="modal-footer-split"><small>学校编码用于内部识别，建议保持稳定。</small><div><Button variant="ghost" onClick={onClose}>取消</Button><Button disabled={!name.trim() || !code.trim()} onClick={save}>保存学校</Button></div></div>}>
      <div className="editor-grid">
        <Field label="学校名称" className="field-span-2"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="学校编码"><TextInput value={code} onChange={(event) => setCode(event.target.value)} /></Field>
        <Field label="学校时区"><Select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>{timeZoneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}

function SchoolMembersModal({ schoolId, onClose }: { schoolId: string; onClose: () => void }) {
  const { state, run } = usePlatformStore();
  const operator = currentUser(state);
  const school = state.schools.find((item) => item.id === schoolId);
  const memberships = state.schoolMemberships.filter(
    (item) => item.schoolId === schoolId && item.status === "active" && isStaffRole(item.role)
  );
  const [userId, setUserId] = useState("");
  const [pendingRemoveId, setPendingRemoveId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({
    role: "teacher" as StaffRole,
    countryCode: "+62",
    phone: "",
    name: "",
    note: ""
  });
  const available = state.users
    .filter((user) => isStaffRole(user.role))
    .filter((user) => !memberships.some((item) => item.userId === user.id && item.role === user.role))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "academic" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  const selectedUser = getUser(state, userId);
  const selectedAcademicOtherSchool = selectedUser?.role === "academic"
    ? state.schoolMemberships.find((item) =>
        item.userId === selectedUser.id
        && item.role === "academic"
        && item.status === "active"
        && item.schoolId !== schoolId
      )
    : undefined;
  const pendingMember = getUser(state, pendingRemoveId);
  const pendingTeacherClassCount = pendingMember?.role === "teacher"
    ? state.classes.filter((item) => item.schoolId === schoolId && item.teacherId === pendingMember.id && item.status === "active").length
    : 0;

  function addMember() {
    const user = getUser(state, userId);
    const role = user?.role;
    if (!user || !role || !isStaffRole(role)) return;
    const result = run(
      () => platform.saveSchoolMembership({ schoolId, userId: user.id, role, status: "active", actorId: operator.id }),
      "教职工已加入学校"
    );
    if (result.ok) setUserId("");
  }

  function removeMember() {
    if (pendingTeacherClassCount > 0) return;
    const role = pendingMember?.role;
    if (!pendingMember || !role || !isStaffRole(role)) return;
    const result = run(
      () => platform.saveSchoolMembership({ schoolId, userId: pendingMember.id, role, status: "left", actorId: operator.id }),
      "教职工已移出学校"
    );
    if (result.ok) setPendingRemoveId("");
  }

  function createStaff() {
    if (!school || school.status !== "active") return;
    const result = run(
      () => platform.createSchoolStaff({
        schoolId,
        role: staffForm.role,
        name: staffForm.name,
        phone: `${staffForm.countryCode} ${staffForm.phone.trim()}`.trim(),
        note: staffForm.note,
        timeZone: school.timeZone,
        actorId: operator.id
      }),
      `${staffRoleLabels[staffForm.role]}已添加`
    );
    if (result.ok) {
      setCreateOpen(false);
      setStaffForm({ role: "teacher", countryCode: "+62", phone: "", name: "", note: "" });
    }
  }

  function renderStaffGroup(role: StaffRole) {
    const group = memberships.filter((item) => item.role === role);
    const label = staffRoleLabels[role];
    return (
      <section className="school-staff-group" key={role}>
        <div className="school-staff-group-head">
          <div className="school-staff-group-title">
            <h3>{label}</h3>
            <span className="school-staff-group-count">{group.length}</span>
          </div>
        </div>
        {group.length === 0 && (
          <p className="school-staff-empty">{role === "academic" ? "尚未配置教务" : "尚未配置教师"}</p>
        )}
        {group.map((membership) => {
          const member = getUser(state, membership.userId);
          if (!member) return null;
          return (
            <article className="school-member-row" key={membership.id}>
              <Avatar label={member.avatar} size="sm" tone={role === "academic" ? "mint" : "orange"} />
              <span className="school-member-copy">
                <strong>{member.name}</strong>
                <small>{member.phone || "未填写手机号"} · 加入于 {membership.joinedAt.slice(0, 10)}</small>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setPendingRemoveId(member.id)}>
                <UserMinus size={14} /> 移出
              </Button>
            </article>
          );
        })}
      </section>
    );
  }

  return (
    <>
      <Modal
        open
        title={`${school?.name ?? "学校"} · 教职工管理`}
        onClose={onClose}
        width="760px"
        footer={<div className="modal-footer-split"><small>关联进行中班级的教师不可移出。</small><div><Button variant="ghost" onClick={onClose}>完成</Button></div></div>}
      >
      <div className="school-member-add">
        <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
          <option value="">从已有教职工中选择</option>
          <optgroup label="教务">
            {available.filter((user) => user.role === "academic").map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </optgroup>
          <optgroup label="教师">
            {available.filter((user) => user.role === "teacher").map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </optgroup>
        </Select>
        <div className="school-member-add-actions">
          <Button variant="secondary" disabled={!userId || school?.status !== "active"} onClick={addMember}><UserPlus size={16} /> 加入学校</Button>
          <Button
            aria-expanded={createOpen}
            aria-haspopup="dialog"
            disabled={school?.status !== "active"}
            onClick={() => setCreateOpen(true)}
          >
            <UserRoundPlus size={16} /> 添加成员
          </Button>
        </div>
      </div>
      {available.length === 0 && <p className="school-member-hint">暂无可加入的教务或教师。</p>}
      {selectedAcademicOtherSchool && (
        <p className="school-member-hint is-warning">
          该教务目前属于“{state.schools.find((item) => item.id === selectedAcademicOtherSchool.schoolId)?.name ?? "其他学校"}”，加入后将从原学校移出。
        </p>
      )}

      {pendingMember && (
        <div className={`school-member-remove-confirm ${pendingTeacherClassCount > 0 ? "is-blocked" : ""}`}>
          <div>
            <strong>
              {pendingTeacherClassCount > 0 ? `暂时不能移出 ${pendingMember.name}` : `将 ${pendingMember.name} 移出本校？`}
            </strong>
            <small>
              {pendingTeacherClassCount > 0
                ? `该教师仍关联 ${pendingTeacherClassCount} 个进行中班级。请先在「班级与学生」中为这些班级更换教师，再回到这里移出。`
                : "账号仍会保留，只解除与当前学校的成员关系。"}
            </small>
          </div>
          <div>
            {pendingTeacherClassCount > 0 ? (
              <Button size="sm" variant="secondary" onClick={() => setPendingRemoveId("")}>知道了</Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setPendingRemoveId("")}>取消</Button>
                <Button size="sm" variant="danger" onClick={removeMember}>确认移出</Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="school-staff-groups">
        {renderStaffGroup("academic")}
        {renderStaffGroup("teacher")}
      </div>
      </Modal>

      <Modal
        open={createOpen}
        placement="right"
        title="添加教职工"
        onClose={() => setCreateOpen(false)}
        panelClassName="school-staff-drawer-panel"
        footer={
          <div className="school-staff-drawer-footer">
            <small>手机号用于识别成员，请避免重复。</small>
            <div>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button disabled={!staffForm.name.trim() || !staffForm.phone.trim()} onClick={createStaff}>创建并加入</Button>
            </div>
          </div>
        }
      >
        <div className="school-staff-drawer">
          <div className="school-staff-drawer-intro">
            <span>加入学校</span>
            <strong>{school?.name}</strong>
            <small>创建账号后立即成为本校教职工，无需再从已有名单中选择。</small>
          </div>

          <div className="school-staff-drawer-role">
            <span className="field-label">角色</span>
            <div className="school-staff-role-toggle" role="group" aria-label="教职工角色">
              {(["academic", "teacher"] as StaffRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  className={staffForm.role === role ? "active" : ""}
                  aria-pressed={staffForm.role === role}
                  onClick={() => setStaffForm((value) => ({ ...value, role }))}
                >
                  {staffRoleLabels[role]}
                </button>
              ))}
            </div>
          </div>

          <div className="editor-grid school-staff-drawer-grid">
            <Field label="国际区号">
              <Select value={staffForm.countryCode} onChange={(event) => setStaffForm((value) => ({ ...value, countryCode: event.target.value }))}>
                {countryCodeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            <Field label="手机号">
              <TextInput
                autoFocus
                value={staffForm.phone}
                onChange={(event) => setStaffForm((value) => ({ ...value, phone: event.target.value }))}
                placeholder="不带国际区号"
              />
            </Field>
            <Field label="姓名" className="field-span-2">
              <TextInput value={staffForm.name} onChange={(event) => setStaffForm((value) => ({ ...value, name: event.target.value }))} placeholder="例如：Dewi" />
            </Field>
            <Field label="备注" className="field-span-2">
              <textarea className="input textarea" value={staffForm.note} onChange={(event) => setStaffForm((value) => ({ ...value, note: event.target.value }))} placeholder="例如：负责七八年级教学协调" />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
