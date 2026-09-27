'use client';

/** 管理员登录 / 首次初始化 */
import { useState } from 'react';
import { Btn, Field, Input, useToast } from './ui';
import { api } from '@/lib/api';

export default function LoginView({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
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
      await api.login(username, password);
      toast('登录成功');
      onLogin();
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xl font-bold">B</div>
            <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">博客后台管理</h1>
            <p className="mt-1 text-xs text-slate-400">{mode === 'login' ? '登录以继续' : '首次部署：创建管理员账号'}</p>
          </div>
          <div className="space-y-4">
            <Field label="用户名">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="管理员用户名" autoFocus />
            </Field>
            <Field label="密码">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="密码" />
            </Field>
            {mode === 'setup' && (
              <Field label="确认密码">
                <Input value={password2} onChange={(e) => setPassword2(e.target.value)} type="password" placeholder="再次输入密码" />
              </Field>
            )}
            <Btn onClick={submit} disabled={busy} className="w-full">
              {busy ? '处理中…' : mode === 'login' ? '登 录' : '创建管理员'}
            </Btn>
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">
            {mode === 'login' ? (
              <>
                还没有管理员账号？
                <button className="text-brand-600 dark:text-brand-400 hover:underline ml-1" onClick={() => setMode('setup')}>
                  首次初始化
                </button>
              </>
            ) : (
              <>
                已有账号？
                <button className="text-brand-600 dark:text-brand-400 hover:underline ml-1" onClick={() => setMode('login')}>
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
