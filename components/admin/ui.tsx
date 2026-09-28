'use client';

/** 后台共享 UI 基础组件 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { cx } from '@/lib/utils';

/* ---------- 按钮 ---------- */
export function Btn({
  children, onClick, variant = 'primary', type = 'button', disabled, className, size = 'md',
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  type?: 'button' | 'submit'; disabled?: boolean; className?: string; size?: 'sm' | 'md';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
        variant === 'secondary' && 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-400',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
        variant === 'ghost' && 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ---------- 输入 ---------- */
export function Field({
  label, children, hint,
}: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-shadow',
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
        'w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-shadow font-mono leading-relaxed',
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
        'w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-brand-500',
        props.className,
      )}
    />
  );
}

/* ---------- 卡片 ---------- */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-5', className)}>
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
          <tr className="text-left text-xs text-slate-400 border-b border-slate-200 dark:border-slate-700">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx('px-3 py-2.5 font-medium whitespace-nowrap', className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('px-3 py-3 align-middle', className)}>{children}</td>;
}

/* ---------- 状态徽章 ---------- */
export function Badge({ tone, children }: { tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue'; children: ReactNode }) {
  const tones = {
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    yellow: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
    gray: 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400',
    blue: 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400',
  };
  return (
    <span className={cx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', tones[tone])}>
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
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className={cx(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg fade-in-up flex items-center gap-2',
          toast.tone === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white',
        )}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            {toast.tone === 'ok' ? (
              <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
          {toast.msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/* ---------- 保存状态指示 ---------- */
export function SaveState({
  dirty, busy, savedAt,
}: { dirty?: boolean; busy?: boolean; savedAt?: Date | null }) {
  if (busy) {
    return <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span className="w-3 h-3 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin" />保存中…</span>;
  }
  if (dirty) {
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400"><span className="w-2 h-2 rounded-full bg-brand-500" />有未保存的修改</span>;
  }
  if (savedAt) {
    return <span className="text-xs text-slate-400">已保存 {savedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>;
  }
  return <span className="text-xs text-slate-400" />;
}

/* ---------- 操作列小按钮 ---------- */
export function RowBtn({
  children, onClick, variant = 'secondary', disabled,
}: { children: ReactNode; onClick?: () => void; variant?: 'secondary' | 'danger' | 'ghost'; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'px-2 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50',
        variant === 'secondary' && 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60',
        variant === 'danger' && 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10',
        variant === 'ghost' && 'text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10',
      )}
    >
      {children}
    </button>
  );
}

/* ---------- 空态 / 加载态 ---------- */
export function Empty({ text }: { text: string }) {
  return <div className="py-14 text-center text-sm text-slate-400">{text}</div>;
}

export function Loading() {
  return (
    <div className="py-10 space-y-3" aria-hidden="true">
      <div className="skeleton h-6 w-1/3 rounded" />
      <div className="skeleton h-4 w-2/3 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
    </div>
  );
}
