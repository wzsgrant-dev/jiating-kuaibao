import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { PATH_PREFIX } from "./prefix.js";

const siteDir = path.resolve("_site");
const textExt = new Set([".html", ".css", ".js", ".txt", ".svg", ".json", ".xml"]);
const problems = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const PLAYER_RE =
  /^https:\/\/player\.bilibili\.com\/player\.html\?bvid=(BV[0-9A-Za-z]{10})&autoplay=0&danmaku=0$/;
const WATCH_RE = /^https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]{10})$/;

function classifyExternal(url) {
  const decoded = url.replace(/&amp;/g, "&");
  const player = decoded.match(PLAYER_RE);
  if (player) return { kind: "player", id: player[1] };
  const watch = decoded.match(WATCH_RE);
  if (watch) return { kind: "watch", id: watch[1] };
  return null;
}

function localReferences(text) {
  const urls = new Set();
  for (const match of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    urls.add(match[1]);
  }
  for (const match of text.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const part of match[1].split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url) urls.add(url);
    }
  }
  return urls;
}

async function existsOnDisk(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const disk = path.normalize(path.join(siteDir, decoded));
  if (disk !== siteDir && !disk.startsWith(siteDir + path.sep)) return false;
  try {
    const info = await stat(disk);
    if (info.isDirectory()) {
      await stat(path.join(disk, "index.html"));
    }
    return true;
  } catch {
    return false;
  }
}

const files = await walk(siteDir);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const robots = await readFile(path.join(siteDir, "robots.txt"), "utf8");
if (!/User-agent:\s*\*/.test(robots) || !/Disallow:\s*\//.test(robots)) {
  problems.push("robots.txt must disallow all crawlers");
}

const css = await readFile(path.join(siteDir, "assets/site.css"), "utf8");
for (const family of ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "sans-serif"]) {
  if (!css.includes(family)) problems.push(`stylesheet is missing font ${family}`);
}
if (!css.includes("font-size: 20px") || !css.includes("line-height: 1.8")) {
  problems.push("stylesheet is missing the 20px / 1.8 body type");
}
if (!css.includes("min-height: 56px") || !css.includes("min-height: 48px")) {
  problems.push("stylesheet is missing large tap targets");
}
if (!css.includes("prefers-reduced-motion")) problems.push("stylesheet is missing reduced-motion rules");
if (/https?:\/\//i.test(css) || /@import/i.test(css)) problems.push("stylesheet references an external resource");
if (!css.includes("color-scheme: dark") || css.includes("color-scheme: light")) {
  problems.push("stylesheet is not locked to the dark theme");
}
if (!css.includes("#1a1816") || !css.includes("#e6e1d8")) {
  problems.push("stylesheet is missing the dark background or warm text color");
}

const home = await readFile(path.join(siteDir, "index.html"), "utf8");
if (!home.includes("2026年10月27日")) problems.push("home page is missing the Chinese date");
if (!home.includes("<title>莲tara</title>")) problems.push("home page title is not 莲tara");
if (!home.includes('name="color-scheme" content="dark"')) problems.push("home page is not color-scheme dark");
if (!home.includes('name="theme-color" content="#1A1816"')) problems.push("theme-color is not the dark background");
if (home.includes("家庭快报")) problems.push("home page still says 家庭快报");
if (home.includes("连载") || home.includes('class="serial"')) problems.push("home page shows a serial block with no books");
if (!home.includes("来自悉尼的资讯与生活。")) problems.push("home subtitle is not the neutral line");
if (!home.includes("阅读全文")) problems.push("home feed is missing 阅读全文");
if (!home.includes(".webp") || !home.includes(".jpeg")) {
  problems.push("home page is missing WebP and JPEG sources");
}
const cssHref = PATH_PREFIX === "/" ? "/assets/site.css" : `${PATH_PREFIX}assets/site.css`;
if (!home.includes(cssHref)) problems.push(`stylesheet link is not prefixed (${cssHref})`);
const aiTitleAt = home.indexOf("人工智能新动向");
const waitaraTitleAt = home.indexOf("老采石场变公园");
if (aiTitleAt < 0 || waitaraTitleAt < 0 || aiTitleAt > waitaraTitleAt) {
  problems.push("home feed should list the AI post above the Waitara post");
}
const aiStory = [...home.matchAll(/<article class="story[\s\S]*?<\/article>/g)]
  .map((match) => match[0])
  .find((story) => story.includes("人工智能新动向"));
if (!aiStory) problems.push("home is missing the AI story card");
else if (/<img\b/i.test(aiStory)) problems.push("the coverless AI card on the home page includes an image");

let sawPost = false;
for (const file of htmlFiles) {
  const rel = path.relative(siteDir, file);
  const text = await readFile(file, "utf8");
  if (!text.includes('name="robots"') || !text.includes("content=\"noindex, nofollow\"")) {
    problems.push(`${rel} is missing noindex, nofollow`);
  }
  if (!text.includes('lang="zh-Hans"')) problems.push(`${rel} is missing zh-Hans`);
  if (text.includes("家庭快报")) problems.push(`${rel} still says 家庭快报`);
  if (text.includes("示例")) problems.push(`${rel} still contains 示例`);
  if (/(?:src|href)\s*=\s*["']\/\//i.test(text)) problems.push(`${rel} contains a protocol-relative URL`);
  const playerIds = new Set();
  const watchIds = new Set();
  for (const match of text.matchAll(/https?:\/\/[^"'\\\s<>]+/gi)) {
    const found = classifyExternal(match[0]);
    if (!found) {
      problems.push(`${rel} contains an http(s) URL`);
      continue;
    }
    if (found.kind === "player") playerIds.add(found.id);
    else watchIds.add(found.id);
  }
  for (const id of playerIds) {
    if (!watchIds.has(id)) problems.push(`${rel} embeds ${id} without 在B站打开`);
  }
  for (const id of watchIds) {
    if (!playerIds.has(id)) problems.push(`${rel} links to ${id} without the player`);
  }
  if ((playerIds.size || watchIds.size) && !text.includes("在B站打开")) {
    problems.push(`${rel} is missing 在B站打开`);
  }
  const iframeTags = [...text.matchAll(/<iframe\b[^>]*>/gi)].map((match) => match[0]);
  if (iframeTags.length !== playerIds.size) {
    problems.push(`${rel} iframe count does not match Bilibili players`);
  }
  for (const tag of iframeTags) {
    if (!tag.includes('loading="lazy"')) problems.push(`${rel} video iframe is not lazy-loaded`);
    if (!tag.includes("allowfullscreen")) problems.push(`${rel} video iframe is missing allowfullscreen`);
    const src = tag.match(/\ssrc="([^"]+)"/);
    const found = src && classifyExternal(src[1]);
    if (!found || found.kind !== "player") problems.push(`${rel} iframe src is not the Bilibili player`);
  }
  if (rel.startsWith("posts/")) {
    sawPost = true;
    if (!text.includes("返回首页")) problems.push(`${rel} is missing the home button`);
    const imageCount = (text.match(/<img\b/gi) || []).length;
    if (imageCount > 0) {
      if (text.includes("story-hero") && !text.includes('loading="eager"')) {
        problems.push(`${rel} cover is not eager`);
      }
      if (imageCount > 1 && !text.includes('loading="lazy"')) {
        problems.push(`${rel} does not lazy-load below-fold images`);
      }
    }
    if (text.includes("cover.jpg") || text.includes("figure.jpg")) {
      problems.push(`${rel} still points at an unprocessed source image`);
    }
  }
  for (const url of localReferences(text)) {
    if (url.startsWith("#") || url.startsWith("data:") || url.startsWith("mailto:")) continue;
    if (classifyExternal(url)) continue;
    let pathname = url.split("?")[0].split("#")[0];
    if (PATH_PREFIX !== "/" && pathname.startsWith(PATH_PREFIX)) {
      pathname = `/${pathname.slice(PATH_PREFIX.length)}`;
    } else if (PATH_PREFIX !== "/" && pathname.startsWith(PATH_PREFIX.slice(0, -1))) {
      problems.push(`${rel} has a prefix mismatch: ${url}`);
      continue;
    }
    if (!pathname.startsWith("/")) {
      problems.push(`${rel} has a non-rooted URL: ${url}`);
      continue;
    }
    if (!(await existsOnDisk(pathname))) problems.push(`${rel} points at a missing file: ${url}`);
  }
}

if (!sawPost) problems.push("built site has no post page");

const aiPost = await readFile(path.join(siteDir, "posts/2026-10-27-ai-news/index.html"), "utf8");
if (/<img\b|<picture\b/i.test(aiPost)) problems.push("AI post must not include images");
if (!aiPost.includes("人工智能行业最近有一条值得关注的消息")) {
  problems.push("AI post is missing the replaced opening");
}
if (aiPost.includes("爸、妈") || aiPost.includes("问问家里人")) problems.push("AI post still has the old family wording");

const waitaraPost = await readFile(path.join(siteDir, "posts/2026-10-27-waitara/index.html"), "utf8");
if (!waitaraPost.includes("旧厂房得到保留，前方是大片草坪。")) {
  problems.push("Waitara post is missing the replaced caption");
}
if (!waitaraPost.includes("图：霍恩斯比区政府")) problems.push("Waitara post is missing the photo credit");
if ((waitaraPost.match(/<img\b/gi) || []).length < 3) problems.push("Waitara post is missing its photos");
try {
  await stat(path.join(siteDir, "books"));
  problems.push("book pages should not be generated when there are no books");
} catch {
  // no /books output
}
try {
  await stat(path.join(siteDir, "posts/2026-10-26-sample"));
  problems.push("sample post should not be published");
} catch {
  // sample post removed
}

const js = await readFile(path.join(siteDir, "assets/scroll.js"), "utf8");
if (/https?:\/\//i.test(js)) problems.push("scroll.js contains an http(s) URL");

let bytes = 0;
for (const file of files) {
  const info = await stat(file);
  bytes += info.size;
  const ext = path.extname(file).toLowerCase();
  if (textExt.has(ext)) {
    const text = await readFile(file, "utf8");
    if (ext !== ".html" && /https?:\/\//i.test(text)) {
      problems.push(`${path.relative(siteDir, file)} contains an http(s) URL`);
    }
  }
  if ([".jpg", ".jpeg", ".webp", ".png"].includes(ext) && info.size > 350 * 1024) {
    problems.push(`${path.relative(siteDir, file)} is larger than 350 KiB`);
  }
}

console.log(`Built site: ${(bytes / 1024).toFixed(1)} KiB across ${files.length} files`);
if (problems.length) {
  console.error(problems.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Output checks passed.");
