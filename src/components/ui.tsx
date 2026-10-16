"use client";

import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/** 统一的按钮。变体与参考 HTML 的按钮体系一一对应。 */
export function Button({
  variant = "default",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "quiet" | "danger";
}) {
  const variantClass = {
    default: "",
    primary: "cd-btn-primary",
    quiet: "cd-btn-quiet",
    danger: "cd-btn-danger",
  }[variant];

  return (
    <button type="button" className={`cd-btn ${variantClass} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={`cd-card ${className}`}>{children}</Tag>;
}

export function TextArea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`cd-textarea ${className}`} {...rest} />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="cd-eyebrow">{children}</div>;
}

/** 页面标题区：眉题 + 标题 + 说明，右侧可放操作。 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="cd-title mt-[7px]">{title}</h1>
        {description ? <p className="cd-sub mt-[7px] max-w-[62ch]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-soft border border-dashed border-line bg-[#fcfaf7] px-5 py-8 text-center">
      <div className="font-serif text-[16px] text-[#6b625b]">{title}</div>
      {hint ? <div className="cd-small mt-2">{hint}</div> : null}
    </div>
  );
}

/** 温和的错误提示条。不隐藏技术原因，但不吓人。 */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error";
  children: ReactNode;
}) {
  const toneClass = {
    info: "border-line bg-[#fbf9f6] text-[#5f5851]",
    warn: "border-[#e6dcc8] bg-[#fdfaf2] text-[#7d6a4c]",
    error: "border-[#e8d3cb] bg-[#fdf6f4] text-[#8d5a48]",
  }[tone];

  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-soft border px-4 py-3 text-[13px] leading-[1.8] ${toneClass}`}>
      {children}
    </div>
  );
}

export function LoadingLine({ text }: { text: string }) {
  return <div className="cd-loading">{text}</div>;
}

/** 统计行。用于首页「今天」、成长记录、设置页。 */
export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="cd-stat">
      <span className="cd-stat-label">{label}</span>
      <span className="cd-num">{value}</span>
    </div>
  );
}

/** 确认对话框：删除类操作一律走这里，避免误删。 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认删除",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(41,37,34,.28)] px-5"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[400px] rounded-card border border-line bg-paper p-6 shadow-paper"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cd-h3">{title}</div>
        {description ? <p className="cd-sub mt-2">{description}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>取消</Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
