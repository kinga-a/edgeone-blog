'use client';

/** 分类管理 */
import { useCallback, useEffect, useState } from 'react';
import { Btn, Card, Empty, Loading, Table, Td, Th, useToast, Field, Input, Textarea } from './ui';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { fmtDate } from '@/lib/utils';

export default function CategoriesManager() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const toast = useToast();

  const load = useCallback(() => {
    api.listCategories().then((d) => {
      if (d?.ok) setItems(d.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const startEdit = (c?: Category) => {
    setEditing(c || null);
    setName(c?.name || '');
    setSlug(c?.slug || '');
    setDescription(c?.description || '');
  };

  const save = async () => {
    if (!name.trim()) { toast('请输入分类名称', 'error'); return; }
    try {
      if (editing) {
        await api.updateCategory(editing.id, { name, slug, description });
        toast('分类已更新');
      } else {
        await api.createCategory({ name, slug, description });
        toast('分类已创建');
      }
      startEdit();
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  };

  const remove = async (c: Category) => {
    if (!window.confirm(`确定删除分类「${c.name}」吗？`)) return;
    try {
      await api.deleteCategory(c.id);
      toast('分类已删除');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'error');
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-5">分类管理</h1>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">{editing ? '编辑分类' : '新建分类'}</h2>
          <div className="space-y-3">
            <Field label="名称">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：前端开发" />
            </Field>
            <Field label="别名（slug）" hint="留空自动生成">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="frontend" />
            </Field>
            <Field label="描述">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="!font-sans" />
            </Field>
            <div className="flex gap-2 pt-1">
              <Btn onClick={save}>{editing ? '保存修改' : '创建分类'}</Btn>
              {editing && <Btn variant="secondary" onClick={() => startEdit()}>取消</Btn>}
            </div>
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden">
          {loading ? <Loading /> : items.length ? (
            <Table head={<><Th>名称</Th><Th>别名</Th><Th>文章数</Th><Th>创建时间</Th><Th className="text-right">操作</Th></>}>
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <Td className="font-medium text-slate-800 dark:text-slate-200">{c.name}</Td>
                  <Td className="text-slate-500 dark:text-slate-400 text-xs">/{c.slug}/</Td>
                  <Td className="text-slate-500 dark:text-slate-400">{c.postCount || 0}</Td>
                  <Td className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(c.createdAt)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <button className="mr-3 text-sm text-brand-600 dark:text-brand-400 hover:underline" onClick={() => startEdit(c)}>编辑</button>
                    <button className="text-sm text-rose-500 hover:underline" onClick={() => remove(c)}>删除</button>
                  </Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty text="暂无分类" />
          )}
        </Card>
      </div>
    </div>
  );
}
