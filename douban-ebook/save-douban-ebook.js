/* SPDX-License-Identifier: MIT

Copyright (c) 2024 by Ji Luo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.

This file is part of page-archivist.js. See
  https://github.com/GeeLaw/page-archivist.js

从豆瓣阅读网页版保存用户已经可以阅读的电子书，使用方法是在
  https://read.douban.com/reader/ebook/<book-id>/
页面的控制台粘贴并运行此代码，运行的时候最好保持标签页可见，否则浏览器可能限速

运行的时候应该采用分页视图，且不应改变视图尺寸，因为保存的是当前排版结果

此工具不具有获取非法副本的功能，类似于 youtube-dl，理应不违反 DMCA

*/
(function (prefetch, SavePageDelay, LastPageDelay,
  PollSpan1, PollSpan2, PollRetryCount,
  ConsoleLog)
{
  var href_accurate = document.location.href;
  if (!/^https?:\/\/read\.douban\.com\/reader\/ebook\/([0-9]*)($|\/|\?|#)/i.test(href_accurate))
  {
    window.alert('不是豆瓣阅读书籍');
    return;
  }
  var href_self = href_accurate.replace(/\?.*/, '');
  var href_query = href_self + '?';
  var href_book = new RegExp(href_self.replace(
    /^https?:\/\/read\.douban\.com\/reader\/ebook\/([0-9]*).*$/i,
    '^https?://read\\.douban\\.com/ebook/$1/?$'),
    'i');
  /* 获取总页数 */
  var count_pages = document.querySelectorAll('.total-num');
  if (count_pages.length !== 1)
    throw '多个总页数';
  count_pages = count_pages[0].innerText;
  if (count_pages !== Number(count_pages).toString())
    throw '总页数无效';
  count_pages = Number(count_pages);
  /* 获取用于选择页码的 input 元素 */
  var input_turn_to = document.querySelectorAll('.page-input');
  if (input_turn_to.length !== 1)
    throw '多个页码输入框';
  input_turn_to = input_turn_to[0];
  /* 获取用于选择页码的 button 元素 */
  var button_turn_to = document.querySelectorAll('.page-submit');
  if (button_turn_to.length !== 1)
    throw '多个翻页按钮';
  button_turn_to = button_turn_to[0];
  var html = '', current_page = 0, retry_count, shown_page;
  window.setTimeout(TurnToNextPageAndContinueOrSaveHtml, SavePageDelay);
  /* 翻页是异步的，下面的两个方法大概是想要实现这个逻辑：
  **
  ** for (var current_page = 0; current_page <= count_pages; ++current_pages)
  ** {
  **   await TurnToPage(current_page);
  **   html += document.querySelector('.page.curr-page').outerHTML + '\n';
  ** }
  ** DownloadFile(html);
  **
  ** 但是似乎第一次翻到某页的时候数据和以后不一样，
  ** 所以先翻每一页预热，然后再重新翻页保存，这用 prefetch 指示。
  */
  function TurnToNextPageAndContinueOrSaveHtml()
  {
    /* 之前已经翻到最后一页 */
    if (++current_page > count_pages)
    {
      if (!prefetch)
      {
        SaveHtml();
        return;
      }
      prefetch = false;
      current_page = 0;
      window.setTimeout(TurnToNextPageAndContinueOrSaveHtml, SavePageDelay);
      return;
    }
    /* 翻向下一页 */
    input_turn_to.value = current_page.toString();
    button_turn_to.click();
    if (ConsoleLog)
      console.log('正翻向第 ' + current_page.toString() + ' 页');
    retry_count = PollRetryCount + 1;
    window.setTimeout(PollShownPageAndRetryOrSavePageAndContinue, PollSpan1);
  }
  function PollShownPageAndRetryOrSavePageAndContinue()
  {
    shown_page = document.querySelectorAll('.page.curr-page');
    if (shown_page.length === 1)
    {
      shown_page = shown_page[0];
      if (shown_page.getAttribute('data-pagination') ===
        current_page.toString())
      {
        /* 翻页成功 */
        window.setTimeout(SavePageAndContinue,
          current_page == count_pages ? LastPageDelay : SavePageDelay);
        /* 最后一页有动态内容，需要更长的延时 */
        return;
      }
    }
    /* 已经超时 */
    if (--retry_count === 0)
    {
      window.PartialBookHtml = html;
      var msg = '尝试翻到第 ' + current_page.toString() +
        ' 页时超时，部分结果已经保存到 window.PartialBookHtml';
      console.error(msg);
      window.alert(msg);
      return;
    }
    /* 未成功且未超时 */
    if (ConsoleLog)
      console.log('翻页尚未成功，剩余等待时间是 ' +
        (retry_count * PollSpan2 / 1000.0).toString() + ' 秒');
    window.setTimeout(PollShownPageAndRetryOrSavePageAndContinue, PollSpan2);
  }
  function SavePageAndContinue()
  {
    if (prefetch)
    {
      if (ConsoleLog)
        console.log('翻到了第 ' + current_page.toString() + ' 页');
      return TurnToNextPageAndContinueOrSaveHtml();
    }
    shown_page.classList.remove('curr-page');
    html += shown_page.outerHTML + '\n';
    shown_page.classList.add('curr-page');
    if (ConsoleLog)
      console.log('存下了第 ' + current_page.toString() + ' 页');
    return TurnToNextPageAndContinueOrSaveHtml();
  }
  function HtmlEncode(x)
  {
    return x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function SaveHtml()
  {
    var dom = document.createDocumentFragment();
    var dom_div = document.createElement('div');
    dom_div.innerHTML = html;
    dom.append(dom_div);
    [].map.call(
      /* 查询超链接并稳定化 */
      dom.querySelectorAll('a[href]'),
      function (x) { return x; }
    ).forEach(function (x)
    {
      /* 稳定化超链接 */
      if (x.getAttribute('href').startsWith('#'))
      {
        return;
      }
      if (href_book.test(x.href))
      {
        x.setAttribute('data-save-douban-ebook-book-link', 'book-link');
        x.setAttribute('href', x.href);
        return;
      }
      if (x.href === href_self)
      {
        x.setAttribute('href', '.');
        return;
      }
      if (x.href.startsWith(href_query))
      {
        x.setAttribute('href', x.href.substr(href_self.length));
        return;
      }
      x.setAttribute('href', x.href);
    });
    var pid_map = new Map(), pid_warn = false;
    [].map.call(
      /* 查询段落并稳定化 */
      dom.querySelectorAll('[data-pid]'),
      function (x) { return x; }
    ).forEach(function (x)
    {
      /* 检查重复段落 */
      var pid = x.getAttribute('data-pid');
      var previous = pid_map.get(pid);
      if (previous === x.innerHTML)
      {
        x.setAttribute('data-save-douban-ebook-duplicate', 'duplicate');
        return;
      }
      if (previous !== undefined)
      {
        pid_warn = true;
        console.warn('重复 pid 的段落内容不同，不标记为重复');
        console.warn(x);
        console.warn(previous);
        /* 这里设置的内容不可能是 innerHTML 的返回值
        ** 保证后续再碰到这个 pid 也会有警告
        */
        pid_map.set(pid, '> 该 pid 已经有过至少两个不同的内容了 <');
        return;
      }
      pid_map.set(pid, x.innerHTML);
    });
    var empty_style = /^[ \t\r\n\v]*$/;
    [].map.call(
      /* 查询有内联样式的元素并稳定化 */
      dom.querySelectorAll('[style]'),
      function (x) { return x; }
    ).forEach(function (x)
    {
      /* 删去空内联样式 */
      if (empty_style.test(x.getAttribute('style')))
        x.removeAttribute('style');
    });
    html = '<!DOCTYPE html>\n<html lang="' + document.body.parentElement.lang +
      '" class="' + document.body.parentElement.className + '">\n' +
      '<head>\n<meta charset="utf-8" />\n' +
      '<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />\n' +
      '<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, user-scalable=no, user-scalable=0, minimum-scale=1.0, maximum-scale=1.0" />\n' +
      '<meta name="renderer" content="webkit">\n' +
      '<title>' + HtmlEncode(document.title) + '</title>\n' +
      '<link rel="stylesheet" href="style-douban-ebook.css" />\n' +
      '</head>\n' +
      '<body class="' + document.body.className + '">\n' +
      '<input type="checkbox" id="save-douban-ebook-hide-info" name="save-douban-ebook-hide-info" /><label for="save-douban-ebook-hide-info"> 隐藏非内容数据</label>\n' +
      '<pre class="save-douban-ebook-info"><!--\n-->' +
      HtmlEncode('<!-- 使用 ') +
      '<a href="' +
      HtmlEncode('https://github.com/GeeLaw/page-archivist.js/tree/main/douban-ebook') +
      '">page-archivist.js/douban-ebook</a>' +
      HtmlEncode(' 保存 -->\n') +
      /* 保存时间 */
      HtmlEncode('<!-- 保存于 ' + (new Date()).toISOString() + ' -->\n') +
      /* URL 基准 */
      HtmlEncode('<base href="') +
        '<a href="' + HtmlEncode(href_accurate) + '">' +
        HtmlEncode(href_accurate) + '</a>' +
        HtmlEncode('" />') +
      /* 元数据、样式 */
      HtmlEncode([].map.call(
        document.querySelectorAll('head meta, head title, head link, head style'),
        function (x) { return '\n' + x.outerHTML; }
      ).join('')) +
      /* 样式（阅读器具体大小） */
      HtmlEncode([].map.call(
        document.querySelectorAll('.article[style], .inner[style]'),
        function (x)
        {
          return '\n<div class="' + HtmlEncode(x.className) + '" style="' +
            HtmlEncode(x.getAttribute('style')) + '"></div>';
        }
      ).join('')) +
      '<!--\n--></pre>\n' +
      /* 静态内容 */
      [].map.call(
        document.querySelectorAll('#article-static-content'),
        function (x) { return x.outerHTML + '\n'; }
      ).join('') +
      /* 排版内容 */
      '<div id="ark-reader"><div class="article"><div class="inner">\n' +
      dom_div.innerHTML +
      '\n</div></div></div>\n</body>\n</html>\n';
    window.BookHtml = html;
    var file_name = (href_accurate + '.html').replace(
      /^https?:\/\/read\.douban\.com\/reader\/ebook\/([0-9]*).*$/i,
      'douban-ebook-$1.html');
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    var anchor = document.createElement('a');
    anchor.download = file_name;
    anchor.href = url;
    anchor.innerText = '下载';
    anchor.click();
    URL.revokeObjectURL(url);
    if (pid_warn)
      window.alert('处理重复段落时有警告，已经用 console.warn 输出到控制台了');
  }
})(true, 100, 5000, 100, 500, 10, true);
/* 参数：
** prefetch      是否预热翻页
** SavePageDelay 保存的延时
** LastPageDelay 最后一页动态内容加载延时
** PollSpan1     异步翻页的首次检查延时
** PollSpan2     异步翻页的后续检查延时
** PollCount     异步翻页每页后续检查最大重试次数
** ConsoleLog    是否调用 console.log
*/
