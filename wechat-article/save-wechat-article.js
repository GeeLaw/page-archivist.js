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

保存微信公众号文章

*/
(function ()
{
  var href_regex = /^(https?:\/\/mp\.weixin\.qq\.com\/s\/([0-9a-z_-]*))([\/?#].*)?$/i;
  var href_accurate = document.location.href;
  if (!href_regex.test(href_accurate))
  {
    window.alert('不是微信公众号文章');
    return;
  }
  if (document.querySelectorAll('img.wx_img_placeholder').length !== 0
    || document.querySelectorAll('img.js_img_placeholder').length !== 0)
  {
    window.alert('有未加载的图片，请先滚动到文章各处一次，让所有图片加载');
    return;
  }
  /* 删去所有脚本、离线无意义的链接 */
  QuerySelectorAllToArray(
    'script, link[rel=modulepreload], link[rel=dns-prefetch]'
  ).forEach(function (redundant)
  {
    redundant.parentElement.removeChild(redundant);
  });
  /* 异步固定化所有图片、视频、样式 */
  var images = QuerySelectorAllToArray('img');
  var videos = QuerySelectorAllToArray('video');
  var sources = QuerySelectorAllToArray('source');
  var links = QuerySelectorAllToArray('link[rel=stylesheet]');
  var async_download_fail = false;
  /* 多加的 1 是监视哨，不需要特判没有需要处理元素的情况 */
  var async_downloads = 1 +
    images.length +
    2 * videos.length +
    sources.length +
    links.length;
  images.forEach(function (img)
  {
    if (img.id === 'js_profile_qrcode_img' || img.id === 'js_pc_qr_code_img')
    {
      return AsyncDownloadCompleteOne();
    }
    return ReplaceAttributeByDataUrl(img, 'src', img.src);
  });
  videos.forEach(function (video)
  {
    ReplaceAttributeByDataUrl(video, 'src', video.src);
    return ReplaceAttributeByDataUrl(video, 'poster', video.poster);
  });
  sources.forEach(function (source)
  {
    return ReplaceAttributeByDataUrl(source, 'src', source.src);
  });
  links.forEach(function (link)
  {
    /* 严格来说
    **   style 元素
    **   来自 link 的 style 元素
    **   元素内联的 style 属性
    ** 里面的 URL 应该也要处理，但暂且不管
    */
    return ReplaceLinkCssByStyle(link);
  });
  /* 利用监视哨 */
  return AsyncDownloadCompleteOne();
  /* 下面这个方法在异步操作全部完成后调用 */
  function OnAsyncDownloadsDone()
  {
    /* URL 基准 */
    if (document.querySelectorAll('base').length === 0)
    {
      var base_element = document.createElement('base');
      base_element.href = href_accurate;
      document.head.insertBefore(base_element, document.head.firstChild);
    }
    /* 时间戳、原始 URL */
    document.head.insertBefore(document.createComment('\n使用 page-archivist.js/wechat-article 保存\n  https://github.com/GeeLaw/page-archivist.js/tree/main/wechat-article\n保存于 ' +
        (new Date()).toISOString() + '\n保存自 ' +
        href_accurate.replace(href_regex, '$1') + '\n'
      ), /* 以上内容是 HTML 注释安全的 */
      document.head.firstChild
    );
    var blob = new Blob(
      ['<!DOCTYPE html>\n' + document.body.parentElement.outerHTML],
      { type: 'text/html' }
    );
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.download = href_accurate.replace(
      href_regex, 'wechat-article-$2.html'
    );
    anchor.href = url;
    anchor.click();
    window.setTimeout(function ()
    {
      URL.revokeObjectURL(url);
    }, 40000);
    if (async_download_fail)
    {
      window.alert('有些内容无法固定化，已经用 console.warn 记录');
    }
  }
  /* 主逻辑结束，下面是工具方法和异步回调 */
  function AsyncDownloadCompleteOne()
  {
    if (--async_downloads === 0)
    {
      return OnAsyncDownloadsDone();
    }
  }
  function QuerySelectorAllToArray(query, doc)
  {
    return [].map.call(
      (doc || document).querySelectorAll(query),
      function (x) { return x; }
    );
  }
  function ReplaceAttributeByDataUrl(element, name, url)
  {
    if (!url || url.startsWith('data:'))
    {
      return AsyncDownloadCompleteOne();
    }
    if (url.startsWith('http:'))
    {
      url = 'https:' + url.substr('http:'.length);
    }
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function ()
    {
      if (xhr.readyState !== 4)
      {
        return;
      }
      if (xhr.response === null)
      {
        console.warn('转换 ' + element.tagName + ' 元素的 ' +
          name + ' 属性为数据 URL 时下载\n  ' +
          url + '\n失败，暂且设置为上述 URL');
        console.warn(element);
        async_download_fail = true;
        /* 绝对 URL */
        element.setAttribute(name, url);
        return AsyncDownloadCompleteOne();
      }
      var reader = new FileReader();
      reader.onloadend = function ()
      {
        /* 数据 URL 或绝对 URL */
        element.setAttribute(name,
          reader.result !== null ? reader.result : url);
        return AsyncDownloadCompleteOne();
      }
      reader.readAsDataURL(xhr.response);
    };
    xhr.responseType = 'blob';
    xhr.open('GET', url);
    xhr.send();
  }
  function ReplaceLinkCssByStyle(link)
  {
    var url = link.href;
    if (url.startsWith('data:'))
    {
      return AsyncDownloadCompleteOne();
    }
    if (url.startsWith('http:'))
    {
      url = 'https:' + url.substr('http:'.length);
    }
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function ()
    {
      if (xhr.readyState !== 4)
      {
        return;
      }
      if (xhr.response === null)
      {
        console.warn('转换 link[rel=stylesheet] 元素为 style 元素时下载\n  ' +
          url + '\n失败，暂且设置 src 为上述 URL');
        console.warn(element);
        async_download_fail = true;
        /* 绝对 URL */
        link.setAttribute('href', url);
        return AsyncDownloadCompleteOne();
      }
      /* 替换为 style 元素 */
      var style = document.createElement('style');
      var attributes = link.attributes;
      for (var i = 0; i < attributes.length; ++i)
      {
        if (attributes[i].nodeName !== 'href' &&
          attributes[i].nodeName !== 'rel')
        {
          style.setAttribute(
            attributes[i].nodeName,
            attributes[i].nodeValue
          );
        }
      }
      style.innerHTML = xhr.response;
      link.parentElement.insertBefore(style, link);
      link.parentElement.removeChild(link);
      return AsyncDownloadCompleteOne();
    };
    xhr.responseType = 'text';
    xhr.open('GET', url);
    xhr.send();
  }
})();
