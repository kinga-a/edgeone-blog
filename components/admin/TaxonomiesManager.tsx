'use client';

/** 分类与标签管理：合并为一个板块，Tab 切换；分类已去掉图标/描述 */
import { useCallback, useEffect, useState } from 'react';
import { Btn, Card, Empty, Loading, RowBtn, Table, Td, Th, useToast, Field, Input } from './ui';
import { api } from '@/lib/api';
import type { Category, Tag } from '@/lib/types';
import { fmtDate } from '@/lib/utils';

type TabKey = 'categories' | 'tags';

export default function TaxonomiesManager() {
  const [tab, setTab] = useState<TabKey>('categories');
  const toast = useToast();

  const [catItems, setCatItems] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catBusy, setCatBusy] = useState(false);
  const [catEditing, setCatEditing] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catSort, setCatSort] = useState('0');

  const [tagItems, setTagItems] = useState<Tag[]>([]);
  const [tagLoading, setTagLoading] = useState(true);
  const [tagBusy, setTagBusy] = useState(false);
  const [tagEditing, setTagEditing] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagSlug, setTagSlug] = useState('');
  const [tagSort, setTagSort] = useState('0');

  const loadCats = useCallback(() => {
    api.listCategories().then((d) => { if (d?.ok) setCatItems(d.items); setCatLoading(false); }).catch(() => setCatLoading(false));
  }, []);
  const loadTags = useCallback(() => {
    api.listTags().then((d) => { if (d?.ok) setTagItems(d.items); setTagLoading(false); }).catch(() => setTagLoading(false));
  }, []);

  useEffect(() => { loadCats(); loadTags(); }, [loadCats, loadTags]);

  const startCatEdit = (c?: Category) => {
    setCatEditing(c || null);
    setCatName(c?.name || '');
    setCatSlug(c?.slug || '');
    setCatSort(String(c?.sort ?? 0));
  };
  const startTagEdit = (t?: Tag) => {
    setTagEditing(t || null);
    setTagName(t?.name || '');
    setTagSlug(t?.slug || '');
    setTagSort(String(t?.sort ?? 0));
  };

  const saveCat = async () => {
    if (!catName.trim()) { toast('请输入分类名称', 'error'); return; }
    setCatBusy(true);
    try {
      const body = { name: catName, slug: catSlug, sort: Number(catSort) || 0 };
      if (catEditing) { await api.updateCategory(catEditing.id, body); toast('分类已更新'); }
      else { await api.createCategory(body); toast('分类已创建'); }
      startCatEdit();
      loadCats();
    } catch (e) { toast(e instanceof Error ? e.message : '操作失败', 'error'); }
    setCatBusy(false);
  };

  const saveTag = async () => {
    if (!tagName.trim()) { toast('请输入标签名称', 'error'); return; }
    setTagBusy(true);
    try {
      const body = { name: tagName, slug: tagSlug, sort: Number(tagSort) || 0 };
      if (tagEditing) { await api.updateTag(tagEditing.id, body); toast('标签已更新'); }
      else { await api.createTag(body); toast('标签已创建'); }
      startTagEdit();
      loadTags();
    } catch (e) { toast(e instanceof Error ? e.message : '操作失败', 'error'); }
    setTagBusy(false);
  };

  const removeCat = async (c: Category) => {
    if (!window.confirm(`确定删除分类「${c.name}」吗？`)) return;
    try { await api.deleteCategory(c.id); toast('分类已删除'); loadCats(); }
    catch (e) { toast(e instanceof Error ? e.message : '删除失败', 'error'); }
  };
  const removeTag = async (t: Tag) => {
    if (!window.confirm(`确定删除标签「${t.name}」吗？相关文章将移除该标签。`)) return;
    try { await api.deleteTag(t.id); toast('标签已删除'); loadTags(); }
    catch (e) { toast(e instanceof Error ? e.message : '删除失败', 'error'); }
  };

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'categories', label: '分类', count: catItems.length },
    { key: 'tags', label: '标签', count: tagItems.length },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">分类与标签</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">管理文章所属分类与标签</p>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 mb-5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-[var(--t-card)] dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t.label}（{t.count}）
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {tab === 'categories' ? (
          <>
            <Card>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                {catEditing ? '编辑分类' : '新建分类'}
              </h2>
              <div className="space-y-3.5">
                <Field label="名称">
                  <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="如：前端开发" />
                </Field>
                <Field label="别名（slug）" hint="留空自动生成">
                  <Input value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder="frontend" className="font-mono text-xs" />
                </Field>
                <Field label="排序" hint="数字越小越靠前，默认 0">
                  <Input type="number" value={catSort} onChange={(e) => setCatSort(e.target.value)} placeholder="0" />
                </Field>
                <div className="flex gap-2 pt-1">
                  <Btn onClick={saveCat} loading={catBusy}>{catEditing ? '保存修改' : '创建分类'}</Btn>
                  {catEditing && <Btn variant="secondary" onClick={() => startCatEdit()}>取消</Btn>}
                </div>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden">
              {catLoading ? <Loading /> : catItems.length ? (
                <>
                  <div className="hidden md:block">
                    <Table head={<><Th>名称</Th><Th>别名</Th><Th>排序</Th><Th>文章数</Th><Th>创建时间</Th><Th className="text-right">操作</Th></>}>
                      {catItems.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                          <Td className="font-medium text-slate-800 dark:text-slate-200">{c.name}</Td>
                          <Td className="text-slate-500 dark:text-slate-400 font-mono text-xs">/{c.slug}/</Td>
                          <Td className="text-slate-500 dark:text-slate-400 font-mono text-xs">{c.sort || 0}</Td>
                          <Td className="text-slate-500 dark:text-slate-400 font-mono text-xs">{c.postCount || 0}</Td>
                          <Td className="text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">{fmtDate(c.createdAt)}</Td>
                          <Td className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <RowBtn onClick={() => startCatEdit(c)}>编辑</RowBtn>
                              <RowBtn variant="danger" onClick={() => removeCat(c)}>删除</RowBtn>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                  <div className="block md:hidden">
                    {catItems.map((c) => (
                      <div key={c.id} className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                        <div className="font-medium text-slate-900 dark:text-white truncate">{c.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">/{c.slug}/</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">排序 {c.sort || 0} · {c.postCount || 0} 篇 · {fmtDate(c.createdAt)}</div>
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <RowBtn onClick={() => startCatEdit(c)}>编辑</RowBtn>
                          <RowBtn variant="danger" onClick={() => removeCat(c)}>删除</RowBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty text="暂无分类" />
              )}
            </Card>
          </>
        ) : (
          <>
            <Card>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                {tagEditing ? '编辑标签' : '新建标签'}
              </h2>
              <div className="space-y-3.5">
                <Field label="名称">
                  <Input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="如：Next.js" />
                </Field>
                <Field label="别名（slug）" hint="留空自动生成">
                  <Input value={tagSlug} onChange={(e) => setTagSlug(e.target.value)} placeholder="nextjs" className="font-mono text-xs" />
                </Field>
                <Field label="排序" hint="数字越小越靠前，默认 0">
                  <Input type="number" value={tagSort} onChange={(e) => setTagSort(e.target.value)} placeholder="0" />
                </Field>
                <div className="flex gap-2 pt-1">
                  <Btn onClick={saveTag} loading={tagBusy}>{tagEditing ? '保存修改' : '创建标签'}</Btn>
                  {tagEditing && <Btn variant="secondary" onClick={() => startTagEdit()}>取消</Btn>}
                </div>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden">
              {tagLoading ? <Loading /> : tagItems.length ? (
                <>
                  <div className="hidden md:block">
                    <Table head={<><Th>名称</Th><Th>别名</Th><Th>排序</Th><Th>文章数</Th><Th>创建时间</Th><Th className="text-right">操作</Th></>}>
                      {tagItems.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                          <Td className="font-medium text-slate-800 dark:text-slate-200">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:text-brand-400 text-xs font-medium">
                              #{t.name}
                            </span>
                          </Td>
                          <Td className="text-slate-500 dark:text-slate-400 font-mono text-xs">/{t.slug}/</Td>
                          <Td className="text-slate-500 dark:text-slate-400 font-mono text-xs">{t.sort || 0}</Td>
                          <Td className="text-slate-500 dark:text-slate-400 font-mono text-xs">{t.postCount || 0}</Td>
                          <Td className="text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">{fmtDate(t.createdAt)}</Td>
                          <Td className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <RowBtn onClick={() => startTagEdit(t)}>编辑</RowBtn>
                              <RowBtn variant="danger" onClick={() => removeTag(t)}>删除</RowBtn>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                  <div className="block md:hidden">
                    {tagItems.map((t) => (
                      <div key={t.id} className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                        <div className="font-medium text-slate-900 dark:text-white truncate">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:text-brand-400 text-xs font-medium">
                            #{t.name}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">/{t.slug}/</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">排序 {t.sort || 0} · {t.postCount || 0} 篇 · {fmtDate(t.createdAt)}</div>
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <RowBtn onClick={() => startTagEdit(t)}>编辑</RowBtn>
                          <RowBtn variant="danger" onClick={() => removeTag(t)}>删除</RowBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty text="暂无标签" />
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
