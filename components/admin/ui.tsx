'use client';

/** 后台共享 UI 基础组件（纸墨编辑风进阶版：精致按钮、流光骨架、平滑表单控件与微交互） */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { cx } from '@/lib/utils';

/* ---------- 旋转加载器 ---------- */
export function AdminSpinner({ className }: { className?: string }) {
  return <span className={cx('spinner-ring shrink-0', className)} aria-hidden="true" />;
}

/* ---------- 按钮 ---------- */
export function Btn({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  loading,
  className,
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const isBusy = Boolean(loading) || (typeof children === 'string' && children.endsWith('…'));
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-150 disabled:opacity-55 disabled:cursor-not-allowed whitespace-nowrap select-none active:scale-[0.98]',
        size === 'sm' ? 'px-3 py-1.5 text-xs rounded-lg' : 'px-4 py-2.5 text-sm',
        variant === 'primary' &&
          'bg-brand-600 text-white hover:bg-brand-700 hover:-translate-y-0.5 disabled:hover:translate-y-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_rgba(154,67,24,0.2)]',
        variant === 'secondary' &&
          'bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 hover:-translate-y-0.5 disabled:hover:translate-y-0 shadow-[var(--shadow-xs)]',
        variant === 'danger' &&
          'bg-rose-600 text-white hover:bg-rose-700 hover:-translate-y-0.5 disabled:hover:translate-y-0 shadow-sm',
        variant === 'ghost' &&
          'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800',
        className,
      )}
    >
      {isBusy && <AdminSpinner className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

/* ---------- 输入 ---------- */
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
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block mt-1.5 text-xs text-slate-400 leading-relaxed">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'w-full px-3.5 py-2.5 rounded-xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none shadow-[var(--shadow-xs)] disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900',
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        'w-full px-3.5 py-2.5 rounded-xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none shadow-[var(--shadow-xs)] font-mono leading-relaxed',
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        'w-full px-3.5 py-2.5 rounded-xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 outline-none shadow-[var(--shadow-xs)] cursor-pointer',
        props.className,
      )}
    />
  );
}

/* ---------- 卡片 ---------- */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'bg-[var(--t-card)] dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-[var(--shadow-xs)] p-5 sm:p-6 transition-shadow',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- 表格 ---------- */
export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx('px-4 py-3 font-semibold tracking-wide whitespace-nowrap', className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('px-4 py-3.5 align-middle', className)}>{children}</td>;
}

/* ---------- 状态徽章 ---------- */
export function Badge({ tone, children }: { tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue'; children: ReactNode }) {
  const tones = {
    green: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20',
    yellow: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-500/20',
    red: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-500/20',
    gray: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600',
    blue: 'bg-brand-50 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-500',
  };
  return (
    <span className={cx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', tones[tone])}>
      {children}
    </span>
  );
}

/* ---------- Toast ---------- */
const ToastContext = createContext<(msg: string, tone?: 'ok' | 'error') => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'error' } | null>(null);

  const show = (msg: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3200);
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          className={cx(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl text-sm font-medium shadow-xl fade-in-up flex items-center gap-2.5 border backdrop-blur-md',
            toast.tone === 'ok'
              ? 'bg-emerald-600/95 text-white border-emerald-500/40'
              : 'bg-rose-600/95 text-white border-rose-500/40',
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {toast.tone === 'ok' ? (
                <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              )}
            </svg>
          </span>
          <span>{toast.msg}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

/* ---------- 保存状态指示 ---------- */
export function SaveState({
  dirty,
  busy,
  savedAt,
}: {
  dirty?: boolean;
  busy?: boolean;
  savedAt?: Date | null;
}) {
  if (busy) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
        <AdminSpinner className="w-3 h-3 text-brand-600 dark:text-brand-400" />
        保存中…
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 text-xs font-medium text-brand-600 dark:text-brand-400">
        <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
        有未保存的修改
      </span>
    );
  }
  if (savedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-mono">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" className="text-emerald-500" aria-hidden="true">
          <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        已保存 {savedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }
  return <span className="text-xs text-slate-400" />;
}

/* ---------- 操作列小按钮 ---------- */
export function RowBtn({
  children,
  onClick,
  variant = 'secondary',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-50',
        variant === 'secondary' &&
          'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700',
        variant === 'danger' &&
          'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15',
        variant === 'ghost' &&
          'text-brand-600 dark:text-brand-400 hover:bg-brand-50',
      )}
    >
      {children}
    </button>
  );
}

/* ---------- 空态 / 加载态 ---------- */
export function Empty({ text }: { text: string }) {
  return (
    <div className="py-16 px-4 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-2">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="opacity-45 mb-1" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

export function Loading() {
  return (
    <div className="p-6 space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <div className="skeleton h-6 w-1/3 rounded-lg" />
        <div className="skeleton h-6 w-20 rounded-lg" />
      </div>
      <div className="skeleton h-10 w-full rounded-xl" />
      <div className="skeleton h-10 w-11/12 rounded-xl" />
      <div className="skeleton h-10 w-4/5 rounded-xl" />
    </div>
  );
}
