import { PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ClassSession, PlatformState } from "../domain/types";
import { Button } from "./ui";
import { CalendarModal } from "./CalendarModal";

/** 学生端课表用的课程日历：共享日历组件 + 「课前预习」入口。 */
export function StudentCalendarModal({
  open,
  onClose,
  state,
  sessions,
  onOpenCourseware
}: {
  open: boolean;
  onClose: () => void;
  state: PlatformState;
  sessions: ClassSession[];
  onOpenCourseware: (session: ClassSession) => void;
}) {
  const { t } = useTranslation();
  return (
    <CalendarModal
      open={open}
      onClose={onClose}
      state={state}
      sessions={sessions}
      detailSubtitle={(session) => state.users.find((user) => user.id === session.teacherId)?.name ?? ""}
      renderAction={(session) => (
        <Button size="sm" variant="soft" onClick={() => onOpenCourseware(session)}>
          <PlayCircle size={15} /> {t("student.schedule.previewFallback")}
        </Button>
      )}
    />
  );
}
