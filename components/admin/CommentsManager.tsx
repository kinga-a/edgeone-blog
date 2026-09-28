'use client';

/** 评论审核 */
import { useCallback, useEffect, useState } from 'react';
import { Btn, Card, Empty, Loading, RowBtn, Table, Td, Th, Badge, useToast } from './ui';
import { api } from '@/lib/api';
import type { Comment, CommentStatus } from '@/lib/types';
import { fmtDate } from '@/lib/utils';

const STATUS_FILTERS: Array<{ value: CommentStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
];

export default function CommentsManager() {
  const [items, setItems] = useState<Comment[]>([]);
  const [status, setStatus] = useState<CommentStatus | ''>('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback((p: number, s: CommentStatus | '') => {
    setLoading(true);
    api.listComments({ status: s, page: p })
      .then((d) => {
        if (d?.ok) {
          setItems(d.items);
          setTotalPages(d.totalPages);
        }
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(page, status); }, [page, status, load]);

  const moderate = async (c: Comment, next: CommentStatus) => {
    try {
      await api.moderateComment(c.id, c.postId, next);
      toast(next === 'approved' ? '评论已通过' : next === 'rejected' ? '评论已拒绝' : '已恢复待审核');
      load(page, status);
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  };

  const remove = async (c: Comment) => {
    if (!window.confirm('确定删除这条评论吗？')) return;
    try {
      await api.deleteComment(c.id, c.postId);
      toast('评论已删除');
      load(page, status);
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">评论审核</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">新评论默认进入待审核队列，通过后展示在文章页</p>
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              onClick={() => { setStatus(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${status === f.value ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {loading ? <Loading /> : items.length ? (
          <>
            <Table head={<><Th>评论内容</Th><Th>文章</Th><Th>状态</Th><Th>时间</Th><Th className="text-right">操作</Th></>}>
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <Td className="max-w-md">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{c.author}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{c.content}</div>
                    {c.email && <div className="mt-1 text-xs text-slate-400">{c.email}</div>}
                  </Td>
                  <Td className="text-slate-500 dark:text-slate-400">
                    <a href={`/posts/${c.postSlug}/`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 dark:hover:text-brand-400">
                      <span className="max-w-40 block truncate">{c.postTitle}</span>
                    </a>
                  </Td>
                  <Td>
                    <Badge tone={c.status === 'approved' ? 'green' : c.status === 'pending' ? 'yellow' : 'red'}>
                      {c.status === 'approved' ? '已通过' : c.status === 'pending' ? '待审核' : '已拒绝'}
                    </Badge>
                  </Td>
                  <Td className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(c.createdAt)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {c.status !== 'approved' && (
                        <RowBtn variant="ghost" onClick={() => moderate(c, 'approved')}>通过</RowBtn>
                      )}
                      {c.status !== 'rejected' && (
                        <RowBtn variant="secondary" onClick={() => moderate(c, 'rejected')}>拒绝</RowBtn>
                      )}
                      <RowBtn variant="danger" onClick={() => remove(c)}>删除</RowBtn>
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
          <Empty text="没有符合条件的评论" />
        )}
      </Card>
    </div>
  );
}
