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

const home = await readFile(path.join(siteDir, "index.html"), "utf8");
if (!home.includes("2026年10月26日")) problems.push("home page is missing the Chinese date");
if (!home.includes("<title>莲tara</title>")) problems.push("home page title is not 莲tara");
if (!home.includes("示例：") || !home.includes("开张啦")) problems.push("home page is missing the sample title");
if (home.includes("家庭快报")) problems.push("home page still says 家庭快报");
if (!home.includes(".webp") || !home.includes(".jpeg")) {
  problems.push("home page is missing WebP and JPEG sources");
}
const cssHref = PATH_PREFIX === "/" ? "/assets/site.css" : `${PATH_PREFIX}assets/site.css`;
if (!home.includes(cssHref)) problems.push(`stylesheet link is not prefixed (${cssHref})`);
const serialAt = home.indexOf("连载：《示例书名》");
const continueAt = home.indexOf("继续读第2章");
const newsAt = home.indexOf("开张啦");
if (serialAt < 0 || continueAt < 0 || newsAt < 0 || serialAt > continueAt || continueAt > newsAt) {
  problems.push("home serialization section must show 继续读第2章 above the news feed");
}
const chapter2Href = `${PATH_PREFIX}books/example/2/`.replace(/\/{2,}/g, "/");
if (!home.includes(chapter2Href)) problems.push(`home continue link is missing ${chapter2Href}`);

let sawPost = false;
for (const file of htmlFiles) {
  const rel = path.relative(siteDir, file);
  const text = await readFile(file, "utf8");
  if (!text.includes('name="robots"') || !text.includes("content=\"noindex, nofollow\"")) {
    problems.push(`${rel} is missing noindex, nofollow`);
  }
  if (!text.includes('lang="zh-Hans"')) problems.push(`${rel} is missing zh-Hans`);
  if (text.includes("家庭快报")) problems.push(`${rel} still says 家庭快报`);
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
    if (!text.includes('loading="lazy"')) problems.push(`${rel} does not lazy-load below-fold images`);
    if (!text.includes('loading="eager"')) problems.push(`${rel} cover is not eager`);
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

const toc = await readFile(path.join(siteDir, "books/example/index.html"), "utf8");
const chapter1At = toc.indexOf("第1章");
const chapter2At = toc.indexOf("第2章");
if (chapter1At < 0 || chapter2At < 0 || chapter1At > chapter2At) {
  problems.push("table of contents is not ordered by chapter number");
}
const ch1 = await readFile(path.join(siteDir, "books/example/1/index.html"), "utf8");
const ch2 = await readFile(path.join(siteDir, "books/example/2/index.html"), "utf8");
if (!ch1.includes("2026年10月26日") || !ch2.includes("2026年10月1日")) {
  problems.push("sample chapters should keep their dates, including the earlier date on chapter 2");
}
const ch1Href = `${PATH_PREFIX}books/example/1/`.replace(/\/{2,}/g, "/");
const ch2Href = `${PATH_PREFIX}books/example/2/`.replace(/\/{2,}/g, "/");
if (!ch1.includes(ch2Href) || !ch1.includes(">下一章<")) {
  problems.push("chapter 1 should link 下一章 to chapter 2");
}
if (!ch2.includes(ch1Href) || !ch2.includes(">上一章<")) {
  problems.push("chapter 2 should link 上一章 to chapter 1");
}
if (!ch1.includes('aria-disabled="true"') || !ch2.includes('aria-disabled="true"')) {
  problems.push("missing chapters should keep a large disabled button");
}
if (!ch1.includes(">目录<") || !ch2.includes(">目录<")) problems.push("chapter pages are missing 目录");

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
