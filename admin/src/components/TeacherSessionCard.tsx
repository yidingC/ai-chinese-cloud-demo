import { useNavigate } from "react-router-dom";
import type { ClassSession, PlatformState } from "../domain/types";
import { sessionRuntimeStatus } from "../lib/domain";
import { Button } from "./ui";
import { OperatorSessionCard } from "./OperatorSessionCard";

export function TeacherSessionCard({
  state,
  session,
  focused = false
}: {
  state: PlatformState;
  session: ClassSession;
  focused?: boolean;
}) {
  const navigate = useNavigate();
  const runtime = sessionRuntimeStatus(session);
  const cancelled = runtime === "cancelled";
  const ended = runtime === "ended";
  const designLabel = runtime === "upcoming" ? "备课" : "查看设计";

  return (
    <OperatorSessionCard
      state={state}
      session={session}
      focused={focused}
      actions={
        <>
          {!cancelled && (
            <Button
              size="sm"
              variant="primary"
              className="operator-session-edit"
              onClick={() =>
                navigate(
                  ended
                    ? `/teacher/results?sessionId=${session.id}`
                    : `/teacher/live/${session.id}`
                )
              }
            >
              {ended ? "查看结果" : "进入课堂"}
            </Button>
          )}
          <Button
            size="sm"
            variant={cancelled ? "secondary" : "soft"}
            onClick={() => navigate(`/teacher/session/${session.id}/design`)}
          >
            {designLabel}
          </Button>
        </>
      }
    />
  );
}
