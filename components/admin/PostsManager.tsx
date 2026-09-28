'use client';

/** 文章管理：列表 + 编辑器（Markdown 编辑/预览、封面上传、分类/标签） */
import { useCallback, useEffect, useState } from 'react';
import { Btn, Card, Empty, Loading, Table, Td, Th, Badge, useToast, Field, Input, Textarea, Select } from './ui';
import { api } from '@/lib/api';
import type { Category, Post, PostSummary, Tag } from '@/lib/types';
import { fmtDate, mediaUrl, slugify } from '@/lib/utils';
import MarkdownView from '../MarkdownView';

export default function PostsManager({ route, navigate }: { route: string; navigate: (k: string) => void }) {
  const parts = route.split('/');
  const mode = parts[1] || 'list'; // list | new | edit
  const postId = parts[2] || '';

  if (mode === 'new') return <PostEditor mode="new" navigate={navigate} />;
  if (mode === 'edit' && postId) return <PostEditor mode="edit" postId={postId} navigate={navigate} />;
  return <PostsList navigate={navigate} />;
}

/* ---------------- 列表 ---------------- */

function PostsList({ navigate }: { navigate: (k: string) => void }) {
  const [items, setItems] = useState<PostSummary[]>([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback((p: number, s: string) => {
    setLoading(true);
    api.listPosts({ page: p, pageSize: 15, status: s || undefined, scope: 'admin' })
      .then((d) => {
        if (d?.ok) {
          setItems(d.items);
          setTotalPages(d.totalPages);
          setTotal(d.total);
        }
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(page, status); }, [page, status, load]);

  const remove = async (id: string) => {
    if (!window.confirm('确定删除这篇文章吗？该操作不可恢复。')) return;
    try {
      await api.deletePost(id);
      toast('文章已删除');
      load(page, status);
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">文章管理</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">共 {total} 篇</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-28">
            <option value="">全部</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
          </Select>
          <Btn onClick={() => navigate('posts/new')}>＋ 新建文章</Btn>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {loading ? <Loading /> : items.length ? (
          <>
            <Table
              head={
                <>
                  <Th>标题</Th>
                  <Th>状态</Th>
                  <Th>分类</Th>
                  <Th>发布日期</Th>
                  <Th>阅读</Th>
                  <Th className="text-right">操作</Th>
                </>
              }
            >
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <Td>
                    <div className="font-medium text-slate-800 dark:text-slate-200 max-w-72 truncate">{p.title}</div>
                    <div className="text-xs text-slate-400 truncate max-w-72">/{p.slug}/</div>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <Badge tone={p.status === 'published' ? 'green' : 'gray'}>{p.status === 'published' ? '已发布' : '草稿'}</Badge>
                      {(p.visibility || 'public') === 'private' && <Badge tone="yellow">私人</Badge>}
                    </span>
                  </Td>
                  <Td className="text-slate-500 dark:text-slate-400">{p.categoryName || '—'}</Td>
                  <Td className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(p.publishedAt || p.createdAt)}</Td>
                  <Td className="text-slate-500 dark:text-slate-400">{p.readingTime || 1} 分钟</Td>
                  <Td className="text-right whitespace-nowrap">
                    {p.status === 'published' && (
                      <a href={`/posts/${p.slug}/`} target="_blank" rel="noopener noreferrer" className="mr-3 text-sm text-brand-600 dark:text-brand-400 hover:underline">查看</a>
                    )}
                    <button className="mr-3 text-sm text-brand-600 dark:text-brand-400 hover:underline" onClick={() => navigate(`posts/edit/${p.id}`)}>编辑</button>
                    <button className="text-sm text-rose-500 hover:underline" onClick={() => remove(p.id)}>删除</button>
                  </Td>
                </tr>
              ))}
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-slate-100 dark:border-slate-700/50">
                <Btn size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Btn>
                <span className="text-xs text-slate-400">{page} / {totalPages}</span>
                <Btn size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Btn>
              </div>
            )}
          </>
        ) : (
          <Empty text="暂无文章，点击右上角「新建文章」开始创作" />
        )}
      </Card>
    </div>
  );
}

/* ---------------- 编辑器 ---------------- */

function PostEditor({ mode, postId, navigate }: { mode: 'new' | 'edit'; postId?: string; navigate: (k: string) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [coverKey, setCoverKey] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');

  useEffect(() => {
    Promise.all([api.listCategories().catch(() => null), api.listTags().catch(() => null)]).then(([cs, ts]) => {
      if (cs?.ok) setCategories(cs.items);
      if (ts?.ok) setAllTags(ts.items);
    });
    if (mode === 'edit' && postId) {
      api.getPost(postId).then((d) => {
        if (!d?.ok) return;
        const p: Post = d.post;
        setTitle(p.title);
        setSlug(p.slug);
        setSummary(p.summary);
        setContent(p.content);
        setStatus(p.status);
        setVisibility(p.visibility || 'public');
        setCategoryId(p.categoryId || '');
        setTags(p.tags || []);
        setCoverKey(p.coverKey || '');
        setCoverUrl(p.coverUrl || '');
        setLoading(false);
      }).catch((e) => toast(e.message, 'error'));
    }
  }, [mode, postId, toast]);

  const uploadCover = async (file: File) => {
    try {
      const { url, key } = await api.getUploadUrl({ name: file.name, type: 'cover', contentType: file.type });
      const res = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      if (!res.ok) throw new Error('上传失败');
      setCoverKey(key);
      setCoverUrl('');
      toast('封面上传成功');
    } catch (e) {
      toast(e instanceof Error ? e.message : '封面上传失败', 'error');
    }
  };

  const save = async () => {
    if (!title.trim()) { toast('请填写文章标题', 'error'); return; }
    if (!content.trim()) { toast('请填写文章正文', 'error'); return; }
    setBusy(true);
    // slug 留白（含纯空白）时根据标题自动生成
    const finalSlug = slug.trim() ? slugify(slug) : slugify(title);
    const body = {
      title, slug: finalSlug, summary, content, status, visibility, categoryId,
      tags: tags.map((t) => t.trim()).filter(Boolean),
      coverKey,
      coverUrl: coverUrl.trim(),
    };
    try {
      if (mode === 'new') {
        const d = await api.createPost(body);
        toast(`文章已创建，别名：/${d.post.slug}/`);
        navigate(`posts/edit/${d.post.id}`);
      } else {
        await api.updatePost(postId!, body);
        toast('文章已保存');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error');
    }
    setBusy(false);
  };

  const addTag = (name: string) => {
    const n = name.trim();
    if (!n) return;
    setTags((t) => (t.includes(n) ? t : [...t, n]));
    setTagInput('');
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{mode === 'new' ? '新建文章' : '编辑文章'}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">支持 Markdown 语法：标题、列表、代码块、图片、链接等</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="secondary" onClick={() => navigate('posts')}>返回列表</Btn>
          <Btn onClick={save} disabled={busy}>{busy ? '保存中…' : mode === 'new' ? '创建' : '保存'}</Btn>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Field label="标题">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="文章标题" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="URL 别名（slug）" hint="留空则根据标题自动生成">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-first-post" />
            </Field>
            <div className="space-y-4">
              <Field label="状态">
                <Select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
                  <option value="draft">草稿</option>
                  <option value="published">发布</option>
                </Select>
              </Field>
              <Field label="可见性" hint="私人文章仅管理员登录后可见">
                <Select value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}>
                  <option value="public">公开</option>
                  <option value="private">私人</option>
                </Select>
              </Field>
            </div>
          </div>
          <Field label="摘要" hint="用于列表页与 SEO 描述">
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="!font-sans" placeholder="一句话概括文章内容" />
          </Field>

          {/* 编辑器 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">正文（Markdown）</span>
              <div className="flex gap-1">
                <button
                  className={`px-2.5 py-1 rounded-md text-xs ${!preview ? 'bg-brand-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  onClick={() => setPreview(false)}
                >
                  编辑
                </button>
                <button
                  className={`px-2.5 py-1 rounded-md text-xs ${preview ? 'bg-brand-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  onClick={() => setPreview(true)}
                >
                  预览
                </button>
              </div>
            </div>
            {preview ? (
              <div className="p-4 max-h-[520px] overflow-y-auto">
                <MarkdownView content={content} className="prose" />
              </div>
            ) : (
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={18} placeholder={'# 标题\n\n支持 **加粗**、*斜体*、`代码`、```代码块```、![图片](url) 等' } />
            )}
          </div>
        </div>

        {/* 侧栏 */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">封面图</h3>
            {(() => {
              const previewSrc = coverUrl || (coverKey ? mediaUrl(coverKey) : '');
              return previewSrc ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewSrc} alt="封面" className="w-full rounded-lg object-cover aspect-[16/9] bg-slate-100" />
                  <div className="flex gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => { setCoverKey(''); setCoverUrl(''); }}>移除</Btn>
                    <label className="cursor-pointer">
                      <span className="inline-block px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-400 transition-colors">
                        更换
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 transition-colors">
                  <span className="text-sm text-slate-500 dark:text-slate-400">点击选择封面图片</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                </label>
              );
            })()}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">或使用外部图片 URL（图床 / CDN / 其它站点图片）</p>
              <div className="flex gap-2">
                <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://example.com/cover.jpg" className="flex-1 !font-mono text-xs" />
                <Btn size="sm" variant="secondary" onClick={() => { setCoverUrl(coverUrl.trim()); setCoverKey(''); }}>应用</Btn>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">分类</h3>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">未分类</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {!categories.length && <p className="mt-2 text-xs text-slate-400">暂无分类，可先到「分类管理」创建</p>}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">标签</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs">
                  {t}
                  <button onClick={() => setTags((arr) => arr.filter((x) => x !== t))} className="hover:text-rose-500">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (addTag(tagInput), e.preventDefault())} placeholder="输入标签回车添加" />
              <Btn size="sm" variant="secondary" onClick={() => addTag(tagInput)}>添加</Btn>
            </div>
            {allTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {allTags.filter((t) => !tags.includes(t.name)).slice(0, 12).map((t) => (
                  <button key={t.id} onClick={() => addTag(t.name)} className="px-2 py-0.5 rounded-full text-xs border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-400 transition-colors">
                    #{t.name}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
