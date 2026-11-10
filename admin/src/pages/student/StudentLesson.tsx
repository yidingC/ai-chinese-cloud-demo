import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, Clock3, Download, GraduationCap, LockKeyhole, MapPin, Play, PlayCircle, Sparkles } from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import {
  currentUser,
  getCurrentInteractionVersion,
  getLesson,
  getSession,
  getUser,
  isSessionBooked,
  lessonContent,
  phaseAvailabilityLabel,
  sessionPhase
} from "../../lib/domain";
import type { Material, Phase } from "../../domain/types";
import { Avatar, Badge, Button, Card, EmptyState, Modal, PageHeader, ProgressBar, Tabs } from "../../components/ui";
import { InteractionSetPlayerModal } from "../../components/InteractionSetPlayerModal";
import { MaterialCard } from "../../components/MaterialCard";
import { PmNote } from "../../components/PmNote";
import { useMaterialAudio } from "../../lib/useMaterialAudio";
import { formatDateTime } from "../../lib/format";

/** 课中互动改由学生端 App（移动端）承载，网页端不再展示这一档；恢复时把开关改成 true。 */
const SHOW_LIVE_PHASE = false;

const phaseMeta: Array<{ phase: Phase; labelKey: string; icon: typeof Play }> = [
  { phase: "preview", labelKey: "student.lessonPage.phasePreview", icon: Sparkles },
  // 课中互动这一档先隐藏（去掉下面两行的注释、并把 SHOW_LIVE_PHASE 改成 true 即可恢复）。
  // ...(SHOW_LIVE_PHASE ? [{ phase: "live" as Phase, labelKey: "student.lessonPage.phaseLive", icon: Play }] : []),
  { phase: "review", labelKey: "student.lessonPage.phaseReview", icon: CheckCircle2 }
];

function currentMaterialUrl(material: Material) {
  return material.versions.find((version) => version.version === material.currentVersion)?.url ?? material.versions.at(-1)?.url;
}

export function StudentLesson() {
  const { lessonId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const lesson = getLesson(state, lessonId);
  const sessionId = searchParams.get("sessionId") ?? "";
  const session = sessionId ? getSession(state, sessionId) : undefined;
  const requestedPhase = (searchParams.get("phase") as Phase) || "preview";
  // 带 phase=live 的旧链接（或 App 里跳过来的）在网页端回落到课前预习。
  const initialPhase = requestedPhase === "live" && !SHOW_LIVE_PHASE ? "preview" : requestedPhase;
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [activeCoursewareId, setActiveCoursewareId] = useState<string | null>(null);
  const { playingId, toggle: toggleAudio } = useMaterialAudio();

  const content = lessonContent(state, lessonId, phase, sessionId || undefined);
  const allMaterials = lessonContent(state, lessonId).materials.filter((material): material is Material => Boolean(material));
  const teacher = session ? getUser(state, session.teacherId) : undefined;
  const activeSet = content.sets.find((set) => set.id === activeSetId);
  const activeCourseware = allMaterials.find((material) => material.id === activeCoursewareId);
  const activeCoursewareUrl = activeCourseware ? currentMaterialUrl(activeCourseware) : undefined;
  const activeCoursewareLabel = activeCourseware?.kind === "courseware"
    ? t("student.lessonPage.coursewareInteractive")
    : activeCourseware?.fileType === "pdf"
      ? t("student.lessonPage.coursewarePdf")
      : t("student.lessonPage.coursewareGeneric");
  const activeCoursewareDescription = activeCourseware?.kind === "courseware"
    ? t("student.lessonPage.coursewareInteractiveNote")
    : activeCourseware?.fileType === "pdf"
      ? t("student.lessonPage.coursewarePdfNote")
      : t("student.lessonPage.coursewareGenericNote");
  const defaultCourseware = allMaterials.find((material) => material.kind === "courseware" && currentMaterialUrl(material)) ??
    allMaterials.find((material) => material.fileType === "pdf" && currentMaterialUrl(material));
  const isBooked = session ? isSessionBooked(state, user.id, session.id) : true;
  const phaseOpen = session ? sessionPhase(session, phase) : true;
  const completed = new Set(state.interactionAttempts.filter((attempt) => attempt.studentId === user.id).map((attempt) => attempt.setId));
  const materialsDone = useMemo(() => state.materials.length > 0, [state.materials.length]);

  function changePhase(next: Phase) {
    setPhase(next);
    const params = new URLSearchParams(searchParams);
    params.set("phase", next);
    setSearchParams(params);
  }

  function openCourseware() {
    if (defaultCourseware) setActiveCoursewareId(defaultCourseware.id);
  }

  if (!lesson) {
    return <EmptyState title={t("student.lessonPage.missingTitle")} description={t("student.lessonPage.missingDescription")} action={<Button onClick={() => navigate("/student/schedule")}>{t("student.lessonPage.backToSchedule")}</Button>} />;
  }

  const activeCoursewareTitle = activeCourseware?.kind === "courseware"
    ? activeCourseware.title
    : lesson.id === "lesson-greetings"
      ? t("student.lessonPage.firstLesson")
      : t("student.lessonPage.coursewareSuffix", { title: lesson.title });

  return (
    <>
      <PageHeader
        eyebrow="Lesson learning"
        title={lesson.title}
        description={lesson.description}
        actions={
          <Button variant="secondary" onClick={() => navigate("/student/schedule")}>
            <ArrowLeft size={17} /> {t("student.lessonPage.backToSchedule")}
          </Button>
        }
      />

      <Card className="lesson-overview-card">
        <div className="lesson-cover-large" style={{ background: `linear-gradient(145deg, ${lesson.color}, #f6f3ff)` }}>
          <span>{lesson.coverEmoji}</span>
          <Badge tone="purple">{lesson.tags[0] ?? t("student.lessonPage.defaultTag")}</Badge>
        </div>
        <div className="lesson-overview-copy">
          <h2>{lesson.subtitle}</h2>
          <p>{lesson.description}</p>
          <div className="lesson-overview-meta">
            {session && <span><GraduationCap size={16} /> {session.className}</span>}
            <span><Clock3 size={16} /> {t("student.lessonPage.minutes", { count: lesson.durationMinutes })}</span>
            {session && <span>{formatDateTime(session.startAt, state.ui.timeZone, state.ui.language)}</span>}
            <span><MapPin size={16} /> {session?.roomLabel ?? t("student.lessonPage.onlineRoom")}</span>
            {teacher && (
              <span className="lesson-overview-teacher">
                <Avatar label={teacher.avatar} size="sm" tone="orange" /> {teacher.name}
              </span>
            )}
          </div>
          <div className="lesson-overview-actions">
            <Button variant="secondary" size="sm" disabled={!defaultCourseware} onClick={openCourseware}>
              <PlayCircle size={16} /> {t("student.lessonPage.viewCourseware")}
            </Button>
          </div>
          <PmNote block kind="口径" note="只统计当前学习阶段中已提交作答的互动。">
            <div className="overview-progress">
            <div>
              <span>{t("student.lessonPage.interactionsDone")}</span>
              <strong>{content.sets.filter((set) => completed.has(set.id)).length}/{content.sets.length}</strong>
            </div>
            <ProgressBar value={content.sets.length ? (content.sets.filter((set) => completed.has(set.id)).length / content.sets.length) * 100 : 0} />
            </div>
          </PmNote>
        </div>
      </Card>

      <PmNote kind="规则" note="课前默认提前 48 小时开放，课后默认在下课结束后开放 48 小时；未预约学生不能进入互动和材料。">
        <div className="phase-tabs-wrap">
          <Tabs
            value={phase}
            onChange={changePhase}
            items={phaseMeta.map((item) => ({
              value: item.phase,
              label: t(item.labelKey),
              count: lessonContent(state, lessonId, item.phase).sets.length
            }))}
          />
        </div>
      </PmNote>

      {!isBooked && (
        <Card className="locked-stage-card">
          <LockKeyhole size={25} />
          <div>
            <strong>{t("student.lessonPage.lockedTitle")}</strong>
            <p>{t("student.lessonPage.lockedDescription")}</p>
          </div>
          <PmNote kind="流程" note="返回课表查看已经安排的课程。">
            <Button onClick={() => navigate("/student/schedule")}>{t("student.lessonPage.backToMySchedule")}</Button>
          </PmNote>
        </Card>
      )}

      {isBooked && !phaseOpen && (
        <Card className="locked-stage-card">
          <LockKeyhole size={25} />
          <div>
            <strong>{t("student.phaseLocked")}</strong>
            <p>
              {phase === "live"
                ? t("student.lessonPage.liveLocked") // 课中档隐藏后走不到这里，恢复开关后生效
                : phase === "review"
                  ? t("student.lessonPage.reviewLocked")
                  : t("student.lessonPage.phaseEnded")}
            </p>
          </div>
          {session && <Badge tone="neutral">{phaseAvailabilityLabel(session, phase)}</Badge>}
        </Card>
      )}

      <div className="learning-content-grid">
        <section className="section-block">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Interactions</span>
              <h2>{t(phase === "preview" ? "student.interactionPreview" : phase === "review" ? "student.interactionReview" : "student.interactionLive")}</h2>
            </div>
            <Badge tone="purple">{t("student.lessonPage.itemCount", { count: content.sets.length })}</Badge>
          </div>
          <PmNote block kind="流程" note="开始互动会创建作答记录；再练不会覆盖历史，只更新最佳分。这些互动的结果可以在老师端的课程结果处看到。">
            <div className="interaction-set-list">
            {content.sets.map((set, index) => {
              const done = completed.has(set.id);
              return (
                <Card className={`interaction-set-card ${done ? "completed" : ""}`} key={set.id} interactive>
                  <span className="set-index">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="set-title-row">
                      <h3>{set.title}</h3>
                      {done ? <Badge tone="mint">{t("student.lessonPage.completed")}</Badge> : <Badge tone="orange">{t("student.lessonPage.pending")}</Badge>}
                    </div>
                  </div>
                  <Button
                    disabled={!isBooked || !phaseOpen}
                    onClick={() => setActiveSetId(set.id)}
                  >
                    {done ? t("student.retry") : t("student.lessonPage.startInteraction")}
                  </Button>
                </Card>
              );
            })}
            {content.sets.length === 0 && <EmptyState title={t("student.lessonPage.noInteractionsTitle")} description={t("student.lessonPage.noInteractionsDesc")} />}
            </div>
          </PmNote>
        </section>

        <section className="section-block">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Materials</span>
              <h2>{t("student.material")}</h2>
            </div>
            <Badge tone="blue">{t("student.lessonPage.fileCount", { count: content.materials.length })}</Badge>
          </div>
          <PmNote block kind="口径" note="播放、查看和下载会记录为触达；下载只对已预约且阶段开放的学生生效。">
            <div className="material-list">
            {content.materials.map((material) => (
              <MaterialCard
                key={material!.id}
                material={material!}
                playing={playingId === material!.id}
                onPlay={() => toggleAudio(material!)}
                onDownload={() => run(() => platform.trackDownload(material!.id), t("student.lessonPage.downloadRecorded"))}
                onOpen={() => setActiveCoursewareId(material!.id)}
              />
            ))}
            {content.materials.length === 0 && <EmptyState title={t("student.noMaterials")} />}
            </div>
          </PmNote>
          {materialsDone && <p className="muted-copy">{t("student.lessonPage.downloadNote")}</p>}
        </section>
      </div>

      <Modal
        open={Boolean(activeCourseware)}
        title={activeCoursewareTitle}
        onClose={() => setActiveCoursewareId(null)}
        fullscreen
      >
        {activeCourseware && activeCoursewareUrl && (
          <div className="courseware-player-shell">
            <PmNote block kind="流程" note="全屏只改变课件展示方式，不改变课节进度和作答记录。">
              <div className="courseware-player-toolbar">
              <div>
                <Badge tone="purple">{activeCoursewareLabel}</Badge>
                <span>{activeCoursewareDescription}</span>
              </div>
              </div>
            </PmNote>
            <iframe
              className="courseware-frame"
              src={activeCoursewareUrl}
              title={activeCourseware.title}
            />
          </div>
        )}
      </Modal>

      {activeSet && (
        <InteractionSetPlayerModal
          set={activeSet}
          sessionId={session?.id}
          phase={phase}
          closeLabel={t("student.lessonPage.closePlayer")}
          onClose={() => setActiveSetId(null)}
        />
      )}
    </>
  );
}
