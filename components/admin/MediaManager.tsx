'use client';

/** 媒体库：浏览器直传 Blob（presigned URL）+ 列表 + 删除 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Btn, Card, Empty, Loading, RowBtn, Table, Td, Th, useToast, Badge } from './ui';
import { api } from '@/lib/api';
import type { MediaMeta } from '@/lib/types';
import { fmtDate, mediaUrl } from '@/lib/utils';

const TYPES: Array<{ value: '' | 'cover' | 'image' | 'attachment'; label: string }> = [
  { value: '', label: '全部' },
  { value: 'cover', label: '封面' },
  { value: 'image', label: '图片' },
  { value: 'attachment', label: '附件' },
];

export default function MediaManager() {
  const [items, setItems] = useState<MediaMeta[]>([]);
  const [type, setType] = useState<'' | 'cover' | 'image' | 'attachment'>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = useCallback((p: number, t: string) => {
    setLoading(true);
    api.listMedia({ type: t || undefined, page: p })
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

  useEffect(() => { load(page, type); }, [page, type, load]);

  const upload = async (file: File) => {
    const kind = file.type.startsWith('image/') ? 'image' : 'attachment';
    setUploading(true);
    try {
      const { url, key, uid } = await api.getUploadUrl({ name: file.name, type: kind, contentType: file.type });
      const res = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!res.ok) throw new Error('直传失败');
      toast(`上传成功：${file.name}`);
      if (fileRef.current) fileRef.current.value = '';
      setPage(1);
      load(1, type);
    } catch (e) {
      toast(e instanceof Error ? e.message : '上传失败', 'error');
    }
    setUploading(false);
  };

  const remove = async (m: MediaMeta) => {
    if (!window.confirm(`确定删除文件「${m.name}」吗？`)) return;
    try {
      await api.deleteMedia(m.key, m.uid);
      toast('文件已删除');
      load(page, type);
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'error');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard?.writeText(key).then(() => toast('key 已复制')).catch(() => toast('复制失败', 'error'));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">媒体库</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">共 {total} 个文件 · 存储于 EdgeOne Blob，上传走浏览器直传</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as typeof type); setPage(1); }}
            className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none"
          >
            {TYPES.map((t) => <option key={t.value || 'all'} value={t.value}>{t.label}</option>)}
          </select>
          <Btn onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '上传中…' : '＋ 上传文件'}
          </Btn>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {loading ? <Loading /> : items.length ? (
          <>
            <Table head={<><Th>预览</Th><Th>文件名</Th><Th>类型</Th><Th>上传时间</Th><Th className="text-right">操作</Th></>}>
              {items.map((m) => (
                <tr key={m.uid} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <Td>
                    {m.type === 'attachment' ? (
                      <div className="w-16 h-10 rounded bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={mediaUrl(m.key)} alt={m.name} loading="lazy" className="w-16 h-10 rounded object-cover bg-slate-100 dark:bg-slate-700/50" />
                    )}
                  </Td>
                  <Td>
                    <div className="font-medium text-slate-800 dark:text-slate-200 max-w-56 truncate">{m.name}</div>
                    <button onClick={() => copyKey(m.key)} className="text-xs text-slate-400 hover:text-brand-500 font-mono truncate max-w-56 block" title="复制 key">
                      {m.key}
                    </button>
                  </Td>
                  <Td><Badge tone={m.type === 'cover' ? 'blue' : m.type === 'image' ? 'green' : 'gray'}>{m.type === 'cover' ? '封面' : m.type === 'image' ? '图片' : '附件'}</Badge></Td>
                  <Td className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(m.uploadedAt)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <a href={mediaUrl(m.key)} target="_blank" rel="noopener noreferrer">
                        <RowBtn variant="ghost">打开</RowBtn>
                      </a>
                      <RowBtn variant="danger" onClick={() => remove(m)}>删除</RowBtn>
                    </div>
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
          <Empty text="媒体库为空，点击右上角上传图片或附件" />
        )}
      </Card>
    </div>
  );
}
