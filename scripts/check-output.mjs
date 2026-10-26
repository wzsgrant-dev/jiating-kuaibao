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

let sawPost = false;
for (const file of htmlFiles) {
  const rel = path.relative(siteDir, file);
  const text = await readFile(file, "utf8");
  if (!text.includes('name="robots"') || !text.includes("content=\"noindex, nofollow\"")) {
    problems.push(`${rel} is missing noindex, nofollow`);
  }
  if (!text.includes('lang="zh-Hans"')) problems.push(`${rel} is missing zh-Hans`);
  if (text.includes("家庭快报")) problems.push(`${rel} still says 家庭快报`);
  if (/https?:\/\//i.test(text)) problems.push(`${rel} contains an http(s) URL`);
  if (/(?:src|href)\s*=\s*["']\/\//i.test(text)) problems.push(`${rel} contains a protocol-relative URL`);
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
