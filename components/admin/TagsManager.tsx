'use client';

/** 标签管理 */
import { useCallback, useEffect, useState } from 'react';
import { Btn, Card, Empty, Loading, Table, Td, Th, useToast, Field, Input } from './ui';
import { api } from '@/lib/api';
import type { Tag } from '@/lib/types';
import { fmtDate } from '@/lib/utils';

export default function TagsManager() {
  const [items, setItems] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const toast = useToast();

  const load = useCallback(() => {
    api.listTags().then((d) => {
      if (d?.ok) setItems(d.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const startEdit = (t?: Tag) => {
    setEditing(t || null);
    setName(t?.name || '');
    setSlug(t?.slug || '');
  };

  const save = async () => {
    if (!name.trim()) { toast('请输入标签名称', 'error'); return; }
    try {
      if (editing) {
        await api.updateTag(editing.id, { name, slug });
        toast('标签已更新');
      } else {
        await api.createTag({ name, slug });
        toast('标签已创建');
      }
      startEdit();
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  };

  const remove = async (t: Tag) => {
    if (!window.confirm(`确定删除标签「${t.name}」吗？相关文章将移除该标签。`)) return;
    try {
      await api.deleteTag(t.id);
      toast('标签已删除');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'error');
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-5">标签管理</h1>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">{editing ? '编辑标签' : '新建标签'}</h2>
          <div className="space-y-3">
            <Field label="名称">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：Next.js" />
            </Field>
            <Field label="别名（slug）" hint="留空自动生成">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="nextjs" />
            </Field>
            <div className="flex gap-2 pt-1">
              <Btn onClick={save}>{editing ? '保存修改' : '创建标签'}</Btn>
              {editing && <Btn variant="secondary" onClick={() => startEdit()}>取消</Btn>}
            </div>
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden">
          {loading ? <Loading /> : items.length ? (
            <Table head={<><Th>名称</Th><Th>别名</Th><Th>文章数</Th><Th>创建时间</Th><Th className="text-right">操作</Th></>}>
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <Td className="font-medium text-slate-800 dark:text-slate-200">#{t.name}</Td>
                  <Td className="text-slate-500 dark:text-slate-400 text-xs">/{t.slug}/</Td>
                  <Td className="text-slate-500 dark:text-slate-400">{t.postCount || 0}</Td>
                  <Td className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(t.createdAt)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <button className="mr-3 text-sm text-brand-600 dark:text-brand-400 hover:underline" onClick={() => startEdit(t)}>编辑</button>
                    <button className="text-sm text-rose-500 hover:underline" onClick={() => remove(t)}>删除</button>
                  </Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty text="暂无标签" />
          )}
        </Card>
      </div>
    </div>
  );
}
