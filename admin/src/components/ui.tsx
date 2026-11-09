import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Tone = "purple" | "mint" | "orange" | "pink" | "blue" | "danger" | "neutral";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  return (
    <button className={`button button-${variant} button-${size} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

export function ProgressBar({ value, tone = "purple" }: { value: number; tone?: Tone }) {
  return (
    <div className="progress-track" aria-label={`${Math.round(value)}%`}>
      <span className={`progress-value tone-${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "purple",
  progress,
  className = ""
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  progress?: number;
  className?: string;
}) {
  return (
    <article className={`stat-card ${className}`}>
      <div className={`stat-icon tone-bg-${tone}`}>{icon}</div>
      <div className="stat-copy">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {detail && <span className="stat-detail">{detail}</span>}
      </div>
      {typeof progress === "number" && <ProgressBar value={progress} tone={tone} />}
    </article>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = "", interactive = false, style }: { children: ReactNode; className?: string; interactive?: boolean; style?: React.CSSProperties }) {
  return <section className={`card ${interactive ? "card-interactive" : ""} ${className}`} style={style}>{children}</section>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-orbit" />
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  headerExtra,
  width = "560px",
  fullscreen = false,
  backdropTone = "default",
  panelClassName = "",
  placement = "center"
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 标题栏右侧的补充信息：跟随标题栏常驻，不随内容滚动。 */
  headerExtra?: ReactNode;
  width?: string;
  fullscreen?: boolean;
  /** 深色遮罩用于把内容压暗，突出浮层。 */
  backdropTone?: "default" | "dark";
  /** 个别弹窗需要自己控制最大高度等样式。 */
  panelClassName?: string;
  /** 右侧抽屉适合在当前工作流上完成一个聚焦任务，不打断背后的列表。 */
  placement?: "center" | "right";
}) {
  if (!open) return null;
  return createPortal(
    <div
      className={`modal-backdrop ${fullscreen ? "modal-backdrop-fullscreen" : ""} ${backdropTone === "dark" ? "modal-backdrop-dark" : ""} ${placement === "right" ? "modal-backdrop-side" : ""}`}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={`modal-panel ${fullscreen ? "modal-panel-fullscreen" : ""} ${panelClassName}`} role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: fullscreen ? undefined : width }}>
        <header className="modal-header">
          <h2>{title}</h2>
          {headerExtra && <div className="modal-header-extra">{headerExtra}</div>}
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </Button>
        </header>
        <div className="modal-content">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
}

export function Field({
  label,
  hint,
  children,
  className = ""
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />;
}

/** 编辑表格里的密集输入框：在标题行里显示小标签，而不是外层 Field。 */
export function LabeledInput({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="labeled-input">
      <span>{label}</span>
      <input className={`input ${className}`} {...props} />
    </label>
  );
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`input select ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  compact = false
}: {
  items: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div className={`tabs ${compact ? "tabs-compact" : ""}`} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          className={item.value === value ? "active" : ""}
          onClick={() => onChange(item.value)}
          role="tab"
          aria-selected={item.value === value}
        >
          {item.label}
          {typeof item.count === "number" && <span>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ label, size = "md", tone = "purple" }: { label: string; size?: "sm" | "md" | "lg"; tone?: Tone }) {
  return <span className={`avatar avatar-${size} avatar-${tone}`}>{label.slice(0, 2)}</span>;
}

export function SourceBadge({ source }: { source: string }) {
  const tone: Tone = source === "operator" || source === "academic" ? "orange" : source === "waitlist" ? "blue" : "mint";
  const label = source === "operator" ? "教学管理代约" : source === "academic" ? "学校教务代约" : source === "waitlist" ? "候补转正" : "学生预约";
  return <Badge tone={tone}>{label}</Badge>;
}
