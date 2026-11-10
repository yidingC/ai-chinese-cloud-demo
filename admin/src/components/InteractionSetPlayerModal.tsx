import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { InteractionSet, Phase } from "../domain/types";
import { currentUser, getCurrentInteractionVersion } from "../lib/domain";
import { platform } from "../lib/platform";
import { usePlatformStore } from "../store/usePlatformStore";
import { InteractionPlayer, type PlayerResult } from "./InteractionPlayer";
import { Badge, Button, Modal } from "./ui";
import { PmNote } from "./PmNote";

/**
 * 学生端通用互动弹窗：课节学习页和首页「学习任务」都用它，
 * 答完直接写一条答题记录，不用再跳到课节页。
 */
export function InteractionSetPlayerModal({
  set,
  sessionId,
  phase,
  closeLabel,
  onClose
}: {
  set: InteractionSet;
  sessionId?: string;
  phase: Phase;
  closeLabel?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const version = getCurrentInteractionVersion(state, set);
  const [lastResult, setLastResult] = useState<PlayerResult | null>(null);

  return (
    <Modal
      open
      title={set.title}
      onClose={onClose}
      width="900px"
      footer={
        lastResult ? (
          <div className="result-modal-footer">
            <span>{t("student.player.score")}</span>
            <strong>{lastResult.score}</strong>
            {lastResult.score < 100 && <Badge tone="orange">{t("student.player.improve")}</Badge>}
          </div>
        ) : undefined
      }
    >
      {version && !lastResult && (
        <PmNote block kind="流程" note="提交后记录本次答案、得分、用时与错题，并绑定当前互动版本。">
          <InteractionPlayer
            items={version.items}
            onClose={onClose}
            onComplete={(result) => {
              setLastResult(result);
              run(
                () =>
                  platform.recordAttempt({
                    setId: set.id,
                    studentId: user.id,
                    sessionId,
                    phase,
                    answers: result.answers,
                    score: result.score,
                    timeSpentSeconds: result.elapsedSeconds,
                    wrongItemIds: result.wrongItemIds,
                    pollAnswers: result.pollAnswers
                  }),
                t("student.player.submittedToast", { score: result.score })
              );
            }}
          />
        </PmNote>
      )}
      {lastResult && (
        <div className="player-result-summary">
          <div className="result-score-ring">
            <strong>{lastResult.score}</strong>
            <span>{t("student.player.points")}</span>
          </div>
          <div>
            <h3>{lastResult.score === 100 ? t("student.player.perfect") : t("student.player.retryMessage")}</h3>
            <p>{t("student.player.summary", { seconds: lastResult.elapsedSeconds, wrong: lastResult.wrongItemIds.length })}</p>
          </div>
          <PmNote kind="流程" note="再次提交会新增一条作答历史，并保留历史最高分。">
            <Button onClick={() => setLastResult(null)}>{t("student.retry")}</Button>
          </PmNote>
          <Button variant="secondary" onClick={onClose}>{closeLabel ?? t("common.close")}</Button>
        </div>
      )}
    </Modal>
  );
}
