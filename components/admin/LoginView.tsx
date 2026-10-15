'use client';

/** 管理员登录 / 首次初始化（支持 TOTP 两步验证 + 密码显隐切换 + 回车提交） */
import { useState } from 'react';
import { Btn, Field, Input, useToast } from './ui';
import { api } from '@/lib/api';

export default function LoginView({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [totp, setTotp] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!username.trim() || !password) {
      toast('请填写用户名和密码', 'error');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'setup') {
        if (password.length < 8) {
          toast('密码至少 8 个字符', 'error');
          setBusy(false);
          return;
        }
        if (password !== password2) {
          toast('两次输入的密码不一致', 'error');
          setBusy(false);
          return;
        }
        await api.setup(username, password);
        toast('管理员创建成功，请登录');
        setMode('login');
        setBusy(false);
        return;
      }
      const d = await api.login(username, password, totpRequired ? totp : undefined);
      if (d.totpRequired) {
        setTotpRequired(true);
        toast('请输入动态验证码完成登录');
        setBusy(false);
        return;
      }
      toast('登录成功');
      onLogin();
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
    setBusy(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !busy) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-10 fade-in-up">
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden bg-[var(--t-card)] dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-[0_12px_36px_rgba(154,67,24,0.08)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-brand-600" aria-hidden="true" />
          <div className="text-center mb-7">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-600 flex items-center justify-center text-white text-xl font-bold font-display shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_rgba(154,67,24,0.28)]">
              B
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
              {totpRequired ? '两步验证' : mode === 'login' ? '博客后台管理' : '初始化管理员'}
            </h1>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {totpRequired
                ? '请输入身份验证器中的 6 位动态验证码'
                : mode === 'login'
                  ? '欢迎回来，请登录以继续管理博客'
                  : '首次部署：创建站点管理员账号'}
            </p>
          </div>
          <div className="space-y-4" onKeyDown={onKeyDown}>
            <Field label="用户名">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="管理员用户名"
                autoFocus
                disabled={totpRequired}
              />
            </Field>
            <Field label="密码">
              <div className="relative">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPwd ? 'text' : 'password'}
                  placeholder={mode === 'setup' ? '至少 8 位字符' : '请输入密码'}
                  disabled={totpRequired}
                  className="pr-10"
                />
                {!totpRequired && (
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPwd ? '隐藏密码' : '显示密码'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showPwd ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </Field>
            {totpRequired ? (
              <Field label="动态验证码">
                <Input
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  placeholder="6 位数字验证码"
                  inputMode="numeric"
                  maxLength={6}
                  className="text-center tracking-[0.3em] font-mono text-base"
                  autoFocus
                />
              </Field>
            ) : mode === 'setup' ? (
              <Field label="确认密码">
                <Input
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="再次输入密码"
                />
              </Field>
            ) : null}
            <Btn onClick={submit} disabled={busy} loading={busy} className="w-full !py-3 mt-1">
              {busy ? '处理中…' : totpRequired ? '验证并登录' : mode === 'login' ? '登 录' : '创建管理员'}
            </Btn>
          </div>
          <p className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 text-center text-xs text-slate-400">
            {totpRequired ? (
              <button
                className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
                onClick={() => { setTotpRequired(false); setTotp(''); }}
              >
                ← 返回上一步
              </button>
            ) : mode === 'login' ? (
              <>
                还没有管理员账号？
                <button
                  className="text-brand-600 dark:text-brand-400 hover:underline font-medium ml-1"
                  onClick={() => setMode('setup')}
                >
                  首次初始化
                </button>
              </>
            ) : (
              <>
                已有账号？
                <button
                  className="text-brand-600 dark:text-brand-400 hover:underline font-medium ml-1"
                  onClick={() => setMode('login')}
                >
                  返回登录
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
