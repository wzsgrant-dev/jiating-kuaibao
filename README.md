# 莲tara

给家里看的静态小站。手机上打开，字大、对比清楚、没有登录，也没有任何第三方脚本。页面发布在：

https://wzsgrant-dev.github.io/jiating-kuaibao/

构建器用的是 [Eleventy](https://www.11ty.dev/)。加一篇新的近况，就是加一个 Markdown 文件和它的图片。

## 怎么加一篇新的近况

1. 在 `src/posts/` 下新建一个文件夹。名字用日期加一个短拼音，方便自己找，例如 `src/posts/2026-11-02-zhoumo/`。**排序不看文件夹名字**，只看文章里的 `date`。日期越新，越排在首页上面。
2. 把这一篇要用的图片放进同一个文件夹。封面建议横图，宽度 1600 像素左右就够。不要用网上的图片地址。
3. 在这个文件夹里新建 `index.md`，照下面的格式写。`title`、`date`、`cover`、`coverAlt` 必填。`excerpt` 不写的话，会自动取正文开头。`category` 先别写，栏目还没定。
4. 在本机运行 `npm run build`，确认能生成。再推到 `main` 分支，GitHub Actions 会发布到上面的网址。

```markdown
---
title: "周末的公园"
date: 2026-11-02
cover: ./cover.jpg
coverAlt: "一张公园小路的照片，傍晚，没有特写人脸"
excerpt: "今天去公园走了走，风很轻。"
# 以后如果要分栏目，再写一行，例如：
# category: 生活
---

今天去公园走了走。路很平，风也很轻。

![长椅和树影](./bench.jpg)
```

说明：

- `date` 写成 `2026-11-02` 这种样子。页面上会显示成 `2026年11月2日`。
- `cover` 是封面，路径相对这篇 `index.md`，一般写 `./cover.jpg`。
- `coverAlt` 用一句话说明画面里有什么。读屏和网络慢的时候用得上。正文里的图片也要写说明，例如 `![长椅和树影](./bench.jpg)`。说明不能空着。
- 图片放在文章文件夹里，用 `./文件名` 引用。构建时会压成宽不超过 1200 像素的 WebP，并留一份 JPEG，旧一点的手机会用 JPEG。首页第一篇的封面马上加载，其余图片滚到跟前再加载。
- 暂时不想发出来，可以在头信息里加 `draft: true`。
- 不要加评论、表单、统计、外链字体或任何外部脚本。国内手机不挂 VPN 也要打得开。

本地预览：

```bash
npm install
npm run build
npm run preview
```

浏览器打开终端里打印的地址（带 `/jiating-kuaibao/`）。只看草稿也可以 `npm run dev`，同样要带上这个路径。

## 以后如果要加栏目

现在没有栏目。数据已经留好了：文章头信息里的 `category` 会收进 Eleventy 的 `collections.categories`（每个栏目一篇列表，按日期新的在前）。首页卡片上也会带 `data-category`，只是先不显示。

要做成真正的栏目，再在 `src/_includes/base.njk` 里读 `collections.categories`，加一行导航，并给每个栏目一个页面即可。不用改文章的文件夹结构。

## English

Family news, as a static site. Large type, high contrast, no accounts, and no third-party scripts, so it can open on a phone in mainland China. It is published at:

https://wzsgrant-dev.github.io/jiating-kuaibao/

The generator is [Eleventy](https://www.11ty.dev/). A new post is one Markdown file plus the images beside it.

### Add a post

1. Create a folder under `src/posts/`. A date plus a short slug is easy to find, for example `src/posts/2026-11-02-zhoumo/`. **Order comes from the `date` field, not the folder name.** Newer dates are listed first.
2. Put that post's images in the same folder. A cover around 1600 pixels wide is enough. Do not use remote image URLs.
3. Add `index.md` in that folder, using the shape below. `title`, `date`, `cover`, and `coverAlt` are required. If you omit `excerpt`, the first lines of the body are used. Leave `category` unset until sections are decided.
4. Run `npm run build` locally, then push to `main`. GitHub Actions publishes the site.

```markdown
---
title: "周末的公园"
date: 2026-11-02
cover: ./cover.jpg
coverAlt: "一张公园小路的照片，傍晚，没有特写人脸"
excerpt: "今天去公园走了走，风很轻。"
# Later, a section is one line:
# category: 生活
---

今天去公园走了走。路很平，风也很轻。

![长椅和树影](./bench.jpg)
```

- `date` is `YYYY-MM-DD`. The page shows it as `2026年11月2日`.
- `cover` is relative to that `index.md`, usually `./cover.jpg`.
- `coverAlt` is one sentence about the picture. Body images need alt text too: `![长椅和树影](./bench.jpg)`. Empty alt text fails the build.
- The build resizes images to at most 1200 pixels wide and writes WebP plus a JPEG fallback. The newest cover loads immediately; other images are lazy.
- `draft: true` keeps a post out of the site.
- Do not add comments, forms, analytics, hosted fonts, or any external script.

Preview:

```bash
npm install
npm run build
npm run preview
```

Open the printed URL, including `/jiating-kuaibao/`. `npm run dev` is the same path on the Eleventy server.

### Categories later

There is no section nav in v1. A `category` field is already collected into `collections.categories` (newest first within each name), and each card carries `data-category` without displaying it.

To turn that into real sections, read `collections.categories` in `src/_includes/base.njk`, add one row of links, and give each category a page. Posts can stay where they are.

The included post 「示例：莲tara 开张啦」 is a layout sample. Replace it with real notes. Its pictures are locally generated warm shapes, not photographs of people.
