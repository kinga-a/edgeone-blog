'use client';

/** 分类管理 */
import { useCallback, useEffect, useState } from 'react';
import { Btn, Card, Empty, Loading, RowBtn, Table, Td, Th, useToast, Field, Input, Textarea } from './ui';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { fmtDate } from '@/lib/utils';
import { CATEGORY_ICON_SET, CATEGORY_ICON_KEYS, resolveCategoryIcon } from '@/lib/site-icons';

/** 图标预览（24px 朱砂） */
function IconPreview({ icon, size = 20 }: { icon?: string; size?: number }) {
  const r = resolveCategoryIcon(icon);
  const key = r.kind === 'key' ? r.value : '';
  const inner = key ? CATEGORY_ICON_SET[key] : '';
  if (r.kind === 'svg') {
    // 自定义 SVG：直接渲染清洗后的内容
    return <span dangerouslySetInnerHTML={{ __html: r.value }} />;
  }
  if (inner) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <g dangerouslySetInnerHTML={{ __html: inner }} />
      </svg>
    );
  }
  return <span className="text-[11px] font-mono opacity-60">—</span>;
}

export default function CategoriesManager() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [customSvg, setCustomSvg] = useState('');
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
    const cur = c?.icon || '';
    setIcon(cur);
    setCustomSvg(cur.toLowerCase().startsWith('<svg') ? cur : '');
  };

  /** 选择内置图标：清空自定义粘贴内容 */
  const pickIcon = (key: string) => {
    setIcon(key);
    setCustomSvg('');
  };

  /** 粘贴自定义 SVG：优先于内置图标 */
  const applyCustomSvg = (v: string) => {
    setCustomSvg(v);
    const t = v.trim();
    if (t.toLowerCase().startsWith('<svg')) setIcon(t);
  };

  const clearIcon = () => {
    setIcon('');
    setCustomSvg('');
  };

  const save = async () => {
    if (!name.trim()) { toast('请输入分类名称', 'error'); return; }
    try {
      const body = { name, slug, description, icon };
      if (editing) {
        await api.updateCategory(editing.id, body);
        toast('分类已更新');
      } else {
        await api.createCategory(body);
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

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
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
            <Field label="图标" hint="点击选择内置图标，或在下框粘贴自定义 SVG（页面将使用该图标，不再显示汉字）">
              <div className="grid grid-cols-6 gap-1.5">
                <button
                  type="button"
                  onClick={clearIcon}
                  title="无图标（按分类名兜底）"
                  className={`h-10 rounded-[10px] border flex items-center justify-center text-[11px] font-mono transition-colors ${!icon ? 'border-brand-600 text-brand-600 bg-brand-50' : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-brand-400'}`}
                >
                  默认
                </button>
                {CATEGORY_ICON_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pickIcon(k)}
                    title={k}
                    className={`h-10 rounded-[10px] border flex items-center justify-center transition-colors ${icon === k ? 'border-brand-600 text-brand-600 bg-brand-50' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600'}`}
                  >
                    <IconPreview icon={k} size={18} />
                  </button>
                ))}
              </div>
              <Textarea
                value={customSvg}
                onChange={(e) => applyCustomSvg(e.target.value)}
                rows={3}
                placeholder={'或直接粘贴 SVG：\n<svg viewBox="0 0 24 24" ...>...</svg>'}
                className="!font-mono !text-xs mt-2"
              />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">预览：</span>
                <span className="w-8 h-8 rounded-[8px] bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <IconPreview icon={icon} size={16} />
                </span>
                {icon && (
                  <button type="button" onClick={clearIcon} className="text-xs text-slate-400 hover:text-brand-600">
                    清除
                  </button>
                )}
              </div>
            </Field>
            <div className="flex gap-2 pt-1">
              <Btn onClick={save}>{editing ? '保存修改' : '创建分类'}</Btn>
              {editing && <Btn variant="secondary" onClick={() => startEdit()}>取消</Btn>}
            </div>
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden">
          {loading ? <Loading /> : items.length ? (
            <Table head={<><Th>名称</Th><Th>图标</Th><Th>别名</Th><Th>文章数</Th><Th>创建时间</Th><Th className="text-right">操作</Th></>}>
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <Td className="font-medium text-slate-800 dark:text-slate-200">{c.name}</Td>
                  <Td>
                    <span className="w-8 h-8 inline-flex items-center justify-center rounded-[8px] bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <IconPreview icon={c.icon} size={16} />
                    </span>
                  </Td>
                  <Td className="text-slate-500 dark:text-slate-400 text-xs">/{c.slug}/</Td>
                  <Td className="text-slate-500 dark:text-slate-400">{c.postCount || 0}</Td>
                  <Td className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(c.createdAt)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <RowBtn onClick={() => startEdit(c)}>编辑</RowBtn>
                      <RowBtn variant="danger" onClick={() => remove(c)}>删除</RowBtn>
                    </div>
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
