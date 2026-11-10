import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpenCheck, GraduationCap, Headphones, School, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { roleHome, usePlatformStore } from "../store/usePlatformStore";
import type { Role } from "../domain/types";
import { Badge, Button } from "../components/ui";
import { PmNote } from "../components/PmNote";

const roleCards: Array<{
  role: Role;
  userId: string;
  icon: typeof GraduationCap;
  accent: string;
}> = [
  { role: "student", userId: "student-anisa", icon: BookOpenCheck, accent: "purple" },
  { role: "teacher", userId: "teacher-lina", icon: Headphones, accent: "orange" },
  { role: "operator", userId: "operator-ray", icon: ShieldCheck, accent: "blue" },
  { role: "academic", userId: "academic-shengxin", icon: School, accent: "mint" }
];

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const switchUser = usePlatformStore((store) => store.switchUser);

  function enter(role: Role, userId: string) {
    switchUser(userId);
    navigate(roleHome(role));
  }

  return (
    <main className="login-page">
      <div className="login-aurora aurora-one" />
      <div className="login-aurora aurora-two" />
      <section className="login-hero">
        <div className="login-brand">
          <span className="brand-mark brand-mark-xl">
            <GraduationCap size={30} />
          </span>
          <div>
            <strong>{t("common.appName")}</strong>
            <small>{t("common.adminName")}</small>
          </div>
        </div>
        <Badge tone="purple">
          <Sparkles size={13} /> {t("login.eyebrow")}
        </Badge>
        <h1>{t("login.title")}</h1>
        <p>{t("login.subtitle")}</p>
        <div className="login-highlight">
          <UsersRound size={20} />
          <span>学生预约 · 教师设计 · 学校教务监督</span>
        </div>
      </section>

      <PmNote
        kind="规则"
        block
        className="login-role-note"
        note="身份决定进入后的导航、默认语言、时区和权限范围。本期着重处理学生端和教师端，教学管理端先不处理。"
      >
        <section className="role-card-grid">
          {roleCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className={`role-login-card role-${card.role}`} key={card.role}>
                <span className={`role-card-icon tone-bg-${card.accent}`}>
                  <Icon size={23} />
                </span>
                <Badge tone={card.role === "student" ? "purple" : card.role === "teacher" ? "orange" : card.role === "academic" ? "mint" : "blue"}>
                  {t(`common.${card.role}`)}
                </Badge>
                <h2>{t(`common.${card.role}`)}端</h2>
                <p>{t(`login.${card.role}Desc`)}</p>
                <Button onClick={() => enter(card.role, card.userId)}>
                  {t("login.enter")} <ArrowRight size={17} />
                </Button>
              </article>
            );
          })}
        </section>
      </PmNote>

      <footer className="login-footer">AI Chinese · Interactive classroom prototype · 2026</footer>
    </main>
  );
}
