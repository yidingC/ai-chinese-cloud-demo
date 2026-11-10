import { useMemo } from "react";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, studentMetrics } from "../../lib/domain";
import { ResultsWorkspace } from "../teacher/TeacherResults";

export function StudentResults() {
  const state = usePlatformStore((store) => store.state);
  const user = currentUser(state);
  // 只传入当前学生自己预约过的课次；学生不能跨班查看其他班级。
  const sessions = useMemo(() => studentMetrics(state, user.id).sessions, [state, user.id]);
  return <ResultsWorkspace state={state} sessions={sessions} variant="student" />;
}
