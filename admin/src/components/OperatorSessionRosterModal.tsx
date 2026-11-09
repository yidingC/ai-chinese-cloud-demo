import { useMemo, useState } from "react";
import { RefreshCw, Search, UserRoundPlus } from "lucide-react";
import type { PlatformState, SessionRosterEntry } from "../domain/types";
import { getStudent, getUser, studentAppAccount } from "../lib/domain";
import { platform } from "../lib/platform";
import { usePlatformStore } from "../store/usePlatformStore";
import { Avatar, Badge, Button, EmptyState, Modal, TextInput } from "./ui";

const sourceLabels: Record<SessionRosterEntry["source"], string> = {
  snapshot: "排课快照",
  sync: "班级同步",
  manual: "人工补录"
};

export function OperatorSessionRosterModal({
  state,
  sessionId,
  actorId,
  onClose
}: {
  state: PlatformState;
  sessionId: string;
  actorId: string;
  onClose: () => void;
}) {
  const { run, showToast } = usePlatformStore();
  const session = state.sessions.find((item) => item.id === sessionId);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncOpen, setSyncOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState("");

  const rosterEntries = session?.roster ?? [];
  const activeClassIds = useMemo(
    () => session
      ? state.classEnrollments
        .filter((item) => item.classId === session.classId && item.status === "active")
        .map((item) => item.studentId)
      : [],
    [session, state.classEnrollments]
  );
  const activeClassSet = useMemo(() => new Set(activeClassIds), [activeClassIds]);
  const rosterIdSet = useMemo(() => new Set(rosterEntries.map((entry) => entry.studentId)), [rosterEntries]);
  const syncAddIds = activeClassIds.filter((studentId) => !rosterIdSet.has(studentId));
  const syncRemoveEntries = rosterEntries.filter(
    (entry) => entry.source !== "manual" && !activeClassSet.has(entry.studentId)
  );
  const frozen = Boolean(session && (session.status === "cancelled" || new Date(session.startAt).getTime() <= Date.now()));

  if (!session) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const rosterRows = rosterEntries
    .map((entry) => {
      const user = getUser(state, entry.studentId);
      const profile = getStudent(state, entry.studentId);
      return { entry, user, profile, account: studentAppAccount(user) };
    })
    .filter(({ user, profile, account }) => {
      if (!user) return false;
      if (!normalizedQuery) return true;
      return `${user.name} ${user.phone ?? ""} ${account} ${profile?.level ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  const unboundCount = rosterEntries.filter((entry) => !studentAppAccount(getUser(state, entry.studentId))).length;
  const manualCount = rosterEntries.filter((entry) => entry.source === "manual").length;

  const candidateRows = adding
    ? state.schoolMemberships
      .filter(
        (membership) =>
          membership.schoolId === session.schoolId &&
          membership.role === "student" &&
          membership.status === "active" &&
          !rosterIdSet.has(membership.userId)
      )
      .map((membership) => {
        const user = getUser(state, membership.userId);
        const profile = getStudent(state, membership.userId);
        return { user, profile, account: studentAppAccount(user) };
      })
      .filter(({ user, profile, account }) => {
        if (!user) return false;
        const text = `${user.name} ${user.phone ?? ""} ${account} ${profile?.level ?? ""}`.toLowerCase();
        return text.includes(addQuery.trim().toLowerCase());
      })
    : [];

  function askSyncRoster() {
    if (frozen) return;
    if (!syncAddIds.length && !syncRemoveEntries.length) {
      showToast("课次名单已是最新", "info");
      return;
    }
    setSyncOpen(true);
  }

  function confirmSyncRoster() {
    const result = run(
      () => platform.syncSessionRoster({ sessionId: session!.id, actorId }),
      "课次名单已同步"
    );
    if (result.ok) setSyncOpen(false);
  }

  function toggleCandidate(studentId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function confirmAddStudents() {
    if (!selectedIds.size) return;
    const result = run(
      () => platform.addSessionRosterStudents({
        sessionId: session!.id,
        studentIds: [...selectedIds],
        actorId
      }),
      `已补录 ${selectedIds.size} 名学生`
    );
    if (result.ok) {
      setAdding(false);
      setAddQuery("");
      setSelectedIds(new Set());
    }
  }

  function removeStudent(studentId: string) {
    const result = run(
      () => platform.removeSessionRosterStudent({ sessionId: session!.id, studentId, actorId }),
      "已从本次课名单移出"
    );
    if (result.ok) setConfirmRemoveId("");
  }

  function studentName(studentId: string) {
    return getUser(state, studentId)?.name ?? studentId;
  }

  return (
    <Modal
      open
      title={`课次名单 · ${session.title}`}
      onClose={onClose}
      width="960px"
      footer={
        adding ? (
          <div className="modal-footer-split">
            <small>补录只影响本次课，不会把学生加入班级。</small>
            <div>
              <Button variant="ghost" onClick={() => { setAdding(false); setAddQuery(""); setSelectedIds(new Set()); }}>取消</Button>
              <Button disabled={!selectedIds.size} onClick={confirmAddStudents}>
                {selectedIds.size ? `补录 ${selectedIds.size} 人` : "确认补录"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="modal-footer-split modal-footer-end">
            <div><Button variant="ghost" onClick={onClose}>完成</Button></div>
          </div>
        )
      }
    >
      {adding ? (
        <>
          <div className="session-roster-add-head">
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setAddQuery(""); setSelectedIds(new Set()); }}>
              返回名单
            </Button>
            <div className="search-box session-roster-search">
              <Search size={16} />
              <TextInput value={addQuery} onChange={(event) => setAddQuery(event.target.value)} placeholder="搜索姓名、手机号或 App 账号" />
            </div>
          </div>
          {candidateRows.length > 0 ? (
            <div className="session-roster-candidate-list">
              {candidateRows.map(({ user, profile, account }) => {
                const checked = selectedIds.has(user!.id);
                return (
                  <label className={`session-roster-candidate ${checked ? "is-selected" : ""}`} key={user!.id}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCandidate(user!.id)} />
                    <Avatar label={user!.avatar} size="sm" tone={checked ? "purple" : "neutral"} />
                    <span className="session-roster-candidate-copy">
                      <strong>{user!.name}</strong>
                      <small>{profile?.level ?? "未设置等级"} · {user!.phone || "未填写手机号"}</small>
                    </span>
                    {account ? <Badge tone="mint">已绑定</Badge> : <Badge tone="danger">未绑定</Badge>}
                  </label>
                );
              })}
            </div>
          ) : (
            <EmptyState title={addQuery ? "没有匹配的学生" : "本校没有可补录的学生"} />
          )}
        </>
      ) : (
        <>
          <div className="session-roster-overview">
            <span>{session.className}</span>
            <span aria-hidden="true">·</span>
            <span>应到 <strong>{rosterEntries.length}</strong> 人</span>
            {unboundCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="is-warning">{unboundCount} 人未绑定 App</span>
              </>
            )}
            {manualCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{manualCount} 人补录</span>
              </>
            )}
          </div>

          {frozen && (
            <div className="session-roster-frozen">
              <strong>名单已冻结</strong>
              <span>{session.status === "cancelled" ? "课堂已取消，不能再调整名单。" : "课堂已开始，名单和应到人数保持开课时的快照。"}</span>
            </div>
          )}

          <div className="session-roster-toolbar">
            <div className="search-box session-roster-search">
              <Search size={16} />
              <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、手机号或 App 账号" />
            </div>
            <div className="session-roster-toolbar-actions">
              <Button variant="secondary" onClick={askSyncRoster} disabled={frozen}>
                <RefreshCw size={16} /> 同步名单
              </Button>
              <Button variant="secondary" onClick={() => setAdding(true)} disabled={frozen}>
                <UserRoundPlus size={16} /> 补录学生
              </Button>
            </div>
          </div>

          {syncOpen && (
            <div className="session-roster-sync">
              <div className="session-roster-sync-copy">
                <strong>按当前班级成员同步？</strong>
                <small>自动来源会按班级补入或移出；人工补录的学生保留。</small>
              </div>
              <div className="session-roster-sync-lists">
                <div>
                  <span>新增 {syncAddIds.length} 人</span>
                  <p>{syncAddIds.length ? syncAddIds.map(studentName).join("、") : "无"}</p>
                </div>
                <div>
                  <span>移出 {syncRemoveEntries.length} 人</span>
                  <p>{syncRemoveEntries.length ? syncRemoveEntries.map((entry) => studentName(entry.studentId)).join("、") : "无"}</p>
                </div>
              </div>
              <div className="session-roster-sync-actions">
                <Button variant="ghost" onClick={() => setSyncOpen(false)}>取消</Button>
                <Button onClick={confirmSyncRoster}>确认同步</Button>
              </div>
            </div>
          )}

          {rosterRows.length > 0 ? (
            <div className="session-roster-table">
              <div className="session-roster-table-head">
                <span>学生</span>
                <span>手机号</span>
                <span>App 绑定</span>
                <span>来源</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              {rosterRows.map(({ entry, user, profile, account }) => (
                <div className="session-roster-row" key={entry.studentId}>
                  <div className="class-roster-person">
                    <Avatar label={user!.avatar} size="sm" tone="purple" />
                    <span><strong>{user!.name}</strong><small>{profile?.level ?? "未设置等级"}</small></span>
                  </div>
                  <span className="class-roster-phone">{user!.phone || "未填写"}</span>
                  <div>{account ? <Badge tone="mint">已绑定</Badge> : <Badge tone="neutral">未绑定</Badge>}</div>
                  <div><Badge tone={entry.source === "manual" ? "orange" : "blue"}>{sourceLabels[entry.source]}</Badge></div>
                  <div><Badge tone="mint">应到</Badge></div>
                  <div className="session-roster-row-action">
                    {confirmRemoveId === entry.studentId ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmRemoveId("")}>取消</Button>
                        <Button size="sm" variant="danger" onClick={() => removeStudent(entry.studentId)}>确认移出</Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmRemoveId(entry.studentId)}
                        disabled={frozen}
                      >
                        移出
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={normalizedQuery ? "名单里没有匹配的学生" : "本次课还没有应到学生"} />
          )}
        </>
      )}
    </Modal>
  );
}
