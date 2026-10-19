import type { ReactNode, ButtonHTMLAttributes } from "react";
import {
  ArrowLeft,
  LoaderCircle,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
export function Button({
  children,
  variant = "primary",
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button button-${variant} ${props.className ?? ""}`}
    >
      {busy && <LoaderCircle size={15} className="spin" />}
      {children}
    </button>
  );
}
export function Back({
  onClick,
  label = "Übersicht",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" className="back" onClick={onClick}>
      <ArrowLeft size={17} /> {label}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Notice({
  tone = "info",
  children,
  onClose,
}: {
  tone?: "success" | "error" | "info";
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className={`notice notice-${tone}`}>
      {tone === "error" ? (
        <AlertCircle size={17} />
      ) : (
        <CheckCircle2 size={17} />
      )}
      <div>{children}</div>
      {onClose && (
        <button aria-label="Schließen" onClick={onClose}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function Empty({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Spinner({ label }: { label: string }) {
  return (
    <div className="spinner-block">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
      <small>Je nach Umfang kann die Analyse etwas dauern.</small>
    </div>
  );
}
