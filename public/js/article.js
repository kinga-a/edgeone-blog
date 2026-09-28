/**
 * 服务端渲染文章页交互脚本（原生 JS，无依赖）：
 * - 阅读量统计（每次会话一次）
 * - 点赞（localStorage 防重复）
 * - 评论提交与审核提示
 * - 分享
 * - 代码高亮（highlight.js CDN 懒加载）→ 行号 + 一键复制
 * - 正文图片点击放大预览
 * - 回到顶部按钮
 * - 目录滚动高亮
 */
(function () {
  'use strict';
  var page = document.querySelector('.article-page');
  if (!page) return;
  var postId = page.getAttribute('data-post-id');
  var postSlug = page.getAttribute('data-post-slug');

  /* ---------- 阅读量统计（同一会话仅记一次） ---------- */
  (function () {
    try {
      var key = 'blog-viewed-' + postId;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      fetch('/api/posts/' + encodeURIComponent(postSlug) + '/view', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            var el = document.getElementById('view-count');
            if (el) el.textContent = d.count + ' 阅读';
          }
        })
        .catch(function () {});
    } catch (e) {}
  })();

  /* ---------- 点赞 ---------- */
  (function () {
    var btn = document.getElementById('btn-like');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var key = 'blog-liked-' + postId;
      var liked = false;
      try { liked = localStorage.getItem(key) === '1'; } catch (e) {}
      if (liked) { setTip('你已经点过赞啦～'); return; }
      fetch('/api/posts/' + encodeURIComponent(postSlug) + '/like', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            btn.classList.add('liked');
            var el = document.getElementById('like-count');
            var el2 = document.getElementById('like-count-btn');
            if (el) el.textContent = d.count + ' 赞';
            if (el2) el2.textContent = d.count;
            try { localStorage.setItem(key, '1'); } catch (e) {}
            setTip('感谢点赞！');
          }
        })
        .catch(function () { setTip('操作失败，请稍后重试'); });
    });
  })();

  /* ---------- 评论 ---------- */
  (function () {
    var form = document.getElementById('comment-form');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var author = document.getElementById('c-author');
      var email = document.getElementById('c-email');
      var content = document.getElementById('c-content');
      var tip = document.getElementById('form-tip');
      if (!author.value.trim() || !content.value.trim()) { setTip('请填写昵称和评论内容'); return; }
      var btn = form.querySelector('.btn-submit');
      btn.disabled = true;
      btn.textContent = '提交中…';
      fetch('/api/posts/' + encodeURIComponent(postSlug) + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: author.value.trim(),
          email: email.value.trim(),
          content: content.value.trim()
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            setTip('评论提交成功' + (window.__COMMENT_MODERATION__ ? '，审核通过后展示' : ''));
            form.reset();
          } else {
            setTip(d.error || '提交失败');
          }
        })
        .catch(function () { setTip('提交失败，请稍后重试'); })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = '提交评论';
        });
    });
  })();

  /* ---------- 分享 ---------- */
  window.shareArticle = function () {
    var url = window.location.href;
    var title = document.title;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else {
      var text = title + ' ' + url;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () { setTip('链接已复制'); });
      } else {
        window.prompt('复制链接', url);
      }
    }
  };

  /* ---------- 代码块：语言标签 + 复制 + 行号（在高亮后处理） ---------- */
  function enhanceCodeBlocks() {
    var pres = document.querySelectorAll('.article-body pre.code-block');
    if (!pres.length) return;
    for (var i = 0; i < pres.length; i++) {
      var pre = pres[i];
      if (pre.getAttribute('data-enhanced')) continue;
      pre.setAttribute('data-enhanced', '1');
      var code = pre.querySelector('code');
      if (!code) continue;
      var lang = pre.getAttribute('data-lang') || '';
      var raw = code.textContent || '';

      // 容器
      var wrap = document.createElement('div');
      wrap.className = 'code-block-wrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      // 头部：语言 + 复制
      var head = document.createElement('div');
      head.className = 'code-block-head';
      var langLabel = document.createElement('span');
      langLabel.className = 'code-lang';
      langLabel.textContent = lang || 'code';
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'code-copy-btn';
      copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', function () {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(raw).then(function () {
          copyBtn.textContent = '已复制';
          copyBtn.classList.add('copied');
          setTimeout(function () { copyBtn.textContent = '复制'; copyBtn.classList.remove('copied'); }, 1600);
        }).catch(function () {});
      });
      head.appendChild(langLabel);
      head.appendChild(copyBtn);
      wrap.insertBefore(head, pre);

      // 行号：按换行拆分
      var lines = document.createElement('div');
      lines.className = 'code-lines';
      var parts = code.innerHTML.split('\n');
      var html = '';
      for (var k = 0; k < parts.length; k++) {
        html += '<span class="code-line">' + (parts[k] || '&nbsp;') + '</span>';
      }
      lines.innerHTML = html;
      code.innerHTML = '';
      code.appendChild(lines);
    }
  }

  /* ---------- 代码高亮（highlight.js CDN，懒加载）→ 之后行号化 ---------- */
  (function () {
    var codes = document.querySelectorAll('.article-body pre.code-block code');
    if (!codes.length) return;
    function applyHighlight() {
      if (window.hljs) {
        for (var k = 0; k < codes.length; k++) {
          try { window.hljs.highlightElement(codes[k]); } catch (e) {}
        }
      }
      enhanceCodeBlocks();
    }
    if (window.hljs) { applyHighlight(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js';
    s.async = true;
    s.onload = applyHighlight;
    s.onerror = applyHighlight; // CDN 失败也补行号/复制，只是无高亮
    document.head.appendChild(s);
  })();

  /* ---------- 正文图片点击放大 ---------- */
  (function () {
    var imgs = document.querySelectorAll('.article-body img');
    if (!imgs.length) return;
    var onKey;
    function removeLightbox() {
      var boxes = document.querySelectorAll('.lightbox');
      for (var i = 0; i < boxes.length; i++) boxes[i].remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    onKey = function (e) { if (e.key === 'Escape') removeLightbox(); };
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener('click', function () {
        var box = document.createElement('div');
        box.className = 'lightbox';
        var big = document.createElement('img');
        big.src = this.src;
        big.alt = this.alt || '';
        var close = document.createElement('button');
        close.className = 'lightbox-close';
        close.textContent = '×';
        close.addEventListener('click', removeLightbox);
        box.addEventListener('click', function (e) { if (e.target === box) removeLightbox(); });
        box.appendChild(big);
        box.appendChild(close);
        document.body.appendChild(box);
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKey);
      });
    }
  })();

  /* ---------- 回到顶部 ---------- */
  (function () {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', '回到顶部');
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 16V4M4 10l6-6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);
    function onScroll() {
      btn.classList.toggle('show', window.scrollY > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  /* ---------- 目录滚动高亮 ---------- */
  (function () {
    var links = document.querySelectorAll('.toc-list a');
    if (!links.length) return;
    var headings = Array.prototype.map.call(links, function (a) {
      return document.getElementById(a.getAttribute('href').slice(1));
    }).filter(Boolean);
    var current = null;
    function onScroll() {
      var y = window.scrollY + 120;
      var idx = -1;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].offsetTop <= y) idx = i;
      }
      if (idx !== current) {
        current = idx;
        for (var j = 0; j < links.length; j++) links[j].classList.toggle('active', j === idx);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  function setTip(text) {
    var tip = document.getElementById('form-tip');
    if (!tip) return;
    tip.textContent = text;
    setTimeout(function () { tip.textContent = ''; }, 3000);
  }
})();
