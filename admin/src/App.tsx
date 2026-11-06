import { HashRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "./components/AppShell";
import { currentUser } from "./lib/domain";
import { roleHome, usePlatformStore } from "./store/usePlatformStore";
import type { Role } from "./domain/types";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { StudentBook } from "./pages/student/StudentBook";
import { StudentSchedule } from "./pages/student/StudentSchedule";
import { StudentLesson } from "./pages/student/StudentLesson";
import { StudentGrades } from "./pages/student/StudentGrades";
import { TeacherDashboard } from "./pages/teacher/TeacherDashboard";
import { TeacherLiveClass } from "./pages/teacher/TeacherLiveClass";
import { TeacherLiveClassPreview } from "./pages/teacher/TeacherLiveClassPreview";
import { TeacherSchedule } from "./pages/teacher/TeacherSchedule";

import { TeacherSessionDesign } from "./pages/teacher/TeacherSessionDesign";
import { TeacherMaterials } from "./pages/teacher/TeacherMaterials";
import { TeacherResults } from "./pages/teacher/TeacherResults";
import { TeacherGrades } from "./pages/teacher/TeacherGrades";
import { OperatorDashboard } from "./pages/operator/OperatorDashboard";
import { CourseCatalog } from "./pages/operator/CourseCatalog";
import { OperatorScheduling } from "./pages/operator/OperatorScheduling";
import { OperatorSessionDetail } from "./pages/operator/OperatorSessionDetail";
import { OperatorStudents } from "./pages/operator/OperatorStudents";
import { OperatorStudentDetail } from "./pages/operator/OperatorStudentDetail";
import { OperatorGovernance } from "./pages/operator/OperatorGovernance";
import { OperatorAudit } from "./pages/operator/OperatorAudit";
import { OperatorSchools } from "./pages/operator/OperatorSchools";
import { AcademicDashboard } from "./pages/academic/AcademicDashboard";
import { TeacherPerformance, TeacherPerformanceDetail } from "./pages/academic/TeacherPerformance";

function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const state = usePlatformStore((store) => store.state);
  const user = currentUser(state);
  const location = useLocation();
  if (user.role !== role) {
    return <Navigate to={roleHome(user.role)} replace state={{ from: location.pathname }} />;
  }
  return children;
}

function IndexRedirect() {
  return <Navigate to="/login" replace />;
}

/** 预约名单改成了课表上的弹窗，旧的课次详情链接统一跳回课表并自动弹出名单。 */
function SessionRosterRedirect() {
  const { sessionId = "" } = useParams();
  return <Navigate to={`/teacher/schedule?roster=${sessionId}`} replace />;
}

/** 互动设计库已并入材料库，旧链接保留并自动切换到“我的互动设计”。 */
function InteractionLibraryRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("library", "interactions");
  return <Navigate to={`/teacher/materials?${params.toString()}`} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<IndexRedirect />} />
        <Route element={<AppShell />}>
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route path="/student" element={<RoleGate role="student"><Outlet /></RoleGate>}>
            <Route index element={<StudentDashboard />} />
            <Route path="book" element={<StudentBook />} />
            <Route path="schedule" element={<StudentSchedule />} />
            <Route path="lesson/:lessonId" element={<StudentLesson />} />
            <Route path="grades" element={<StudentGrades />} />
            <Route path="results" element={<Navigate to="/student/grades" replace />} />
          </Route>

          <Route path="/teacher" element={<RoleGate role="teacher"><Outlet /></RoleGate>}>
            <Route index element={<TeacherDashboard />} />
            <Route path="live/:sessionId" element={<TeacherLiveClass />} />
            <Route path="live-preview/:sessionId" element={<TeacherLiveClassPreview />} />
            <Route path="schedule" element={<TeacherSchedule />} />
            <Route path="session/:sessionId" element={<SessionRosterRedirect />} />
            <Route path="session/:sessionId/design" element={<TeacherSessionDesign />} />
            <Route path="interactions" element={<InteractionLibraryRedirect />} />
            <Route path="materials" element={<TeacherMaterials />} />
            <Route path="results" element={<TeacherResults />} />
            <Route path="grades" element={<TeacherGrades />} />
          </Route>

          <Route path="/academic" element={<RoleGate role="academic"><Outlet /></RoleGate>}>
            <Route index element={<AcademicDashboard />} />
            <Route path="scheduling" element={<OperatorScheduling academic basePath="/academic" />} />
            <Route path="sessions/:sessionId" element={<OperatorSessionDetail academic basePath="/academic" />} />
            <Route path="students" element={<OperatorStudents academic basePath="/academic" />} />
            <Route path="students/:studentId" element={<OperatorStudentDetail academic basePath="/academic" />} />
            <Route path="performance" element={<TeacherPerformance />} />
            <Route path="performance/:teacherId" element={<TeacherPerformanceDetail />} />
            <Route path="audit" element={<OperatorAudit academic />} />
            <Route path="catalog" element={<Navigate to="/academic" replace />} />
            <Route path="governance" element={<Navigate to="/academic" replace />} />
          </Route>

          <Route path="/operator" element={<RoleGate role="operator"><Outlet /></RoleGate>}>
            <Route index element={<OperatorDashboard />} />
            <Route path="catalog" element={<CourseCatalog />} />
            <Route path="scheduling" element={<OperatorScheduling />} />
            <Route path="sessions/:sessionId" element={<OperatorSessionDetail />} />
            <Route path="students" element={<OperatorStudents />} />
            <Route path="students/:studentId" element={<OperatorStudentDetail />} />
            <Route path="schools" element={<OperatorSchools />} />
            <Route path="governance" element={<OperatorGovernance />} />
            <Route path="audit" element={<OperatorAudit />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
