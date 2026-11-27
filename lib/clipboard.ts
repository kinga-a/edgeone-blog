/**
 * 复制文本到剪贴板。
 * 安全上下文（https / localhost）优先用 Clipboard API；http://IP 等非安全上下文
 * 下 navigator.clipboard 不可用，回退 document.execCommand('copy') 临时 textarea 方案。
 * 返回是否复制成功，调用方据此给出 toast 或手动复制弹窗。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const value = String(text ?? '');
  if (!value) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* 继续走降级方案 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}