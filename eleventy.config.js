import path from "node:path";
import { readFileSync } from "node:fs";
import { HtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { PATH_PREFIX } from "./scripts/prefix.js";

const INPUT_DIR = path.resolve("src");

const BVID = /^BV[0-9A-Za-z]{10}$/;

function stripPrefix(url) {
  if (!url || PATH_PREFIX === "/") return url || "";
  if (url === PATH_PREFIX || url === PATH_PREFIX.slice(0, -1)) return "/";
  if (url.startsWith(PATH_PREFIX)) return `/${url.slice(PATH_PREFIX.length)}`;
  return url;
}

function assertBvid(value, inputPath) {
  if (value == null || value === false) return "";
  const id = String(value).trim();
  if (!id) return "";
  if (!BVID.test(id)) {
    const where = inputPath ? ` (${inputPath})` : "";
    throw new Error(`bvid must be BV plus 10 letters or digits${where}: ${id}`);
  }
  return id;
}

function assertNoExternalUrls(inputPath) {
  const raw = readFileSync(inputPath, "utf8");
  if (/https?:\/\//i.test(raw) || /(?:src|href)\s*=\s*["']\/\//i.test(raw)) {
    throw new Error(`External URLs are not allowed in ${inputPath}`);
  }
}

function loadBooks() {
  const books = JSON.parse(readFileSync(path.resolve("src/_data/books.json"), "utf8"));
  if (!Array.isArray(books)) throw new Error("src/_data/books.json must be an array");
  const ids = new Set();
  for (const book of books) {
    if (!book || typeof book !== "object") throw new Error("Each book must be an object");
    if (!book.id || !/^[-a-z0-9]+$/.test(book.id)) {
      throw new Error(`Book id must be lowercase letters, numbers, and hyphens: ${book.id}`);
    }
    if (ids.has(book.id)) throw new Error(`Duplicate book id: ${book.id}`);
    ids.add(book.id);
    if (!book.title || !String(book.title).trim()) throw new Error(`Book is missing title: ${book.id}`);
    for (const field of ["author", "translatorNote"]) {
      if (book[field] != null && typeof book[field] !== "string") {
        throw new Error(`${field} must be a string: ${book.id}`);
      }
    }
  }
  return books;
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp", "jpeg"],
    widths: [640, 960, 1200],
    urlPath: "/img/",
    outputDir: path.join("_site", "img"),
    sharpJpegOptions: {
      quality: 80,
      mozjpeg: true,
      progressive: true,
    },
    sharpWebpOptions: {
      quality: 78,
    },
    htmlOptions: {
      imgAttributes: {
        loading: "lazy",
        decoding: "async",
        sizes: "100vw",
      },
    },
  });

  eleventyConfig.addPlugin(HtmlBasePlugin, {
    baseHref: PATH_PREFIX,
  });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.png": "favicon.png" });
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  eleventyConfig.addFilter("zhDate", (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  });

  eleventyConfig.addFilter("isoDate", (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  });

  const brandPlain = "莲tara";
  const brandHtml =
    '<span class="brand"><span class="name-han">莲</span><span class="name-latin">tara</span></span>';
  eleventyConfig.addFilter("brand", (value) => {
    const text = String(value ?? "");
    return text
      .split(brandPlain)
      .map((part) =>
        part.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
      )
      .join(brandHtml);
  });

  eleventyConfig.addFilter("unprefix", (url) => stripPrefix(url));

  eleventyConfig.addFilter("safeBvid", (value) => {
    const id = assertBvid(value);
    if (!id) throw new Error("A Bilibili embed needs a bvid");
    return id;
  });

  eleventyConfig.addFilter("bookMeta", (books, id) => {
    const found = (books || []).find((book) => book.id === id);
    if (!found) throw new Error(`Unknown book id: ${id}`);
    return found;
  });

  eleventyConfig.addFilter("bookChapters", (chapters, bookId) => {
    return (chapters || [])
      .filter((item) => item.data.book === bookId && !item.data.draft)
      .sort((a, b) => Number(a.data.chapter) - Number(b.data.chapter));
  });

  eleventyConfig.addFilter("firstCoverUrl", (posts) => {
    const found = (posts || []).find((post) => post.data.cover);
    return found ? found.url : "";
  });

  eleventyConfig.addFilter("chapterNav", (chapters, pageUrl) => {
    const list = chapters || [];
    const index = list.findIndex((item) => item.url === pageUrl);
    return {
      prev: index > 0 ? list[index - 1] : null,
      next: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
    };
  });

  eleventyConfig.addFilter("coverSrc", (inputPath, cover) => {
    if (!cover || typeof cover !== "string") {
      throw new Error(`Missing cover for ${inputPath}`);
    }
    if (/^https?:\/\//i.test(cover) || cover.startsWith("//")) {
      throw new Error(`External cover images are not allowed (${inputPath}): ${cover}`);
    }
    const absolute = path.resolve(path.dirname(inputPath), cover);
    const relative = path.relative(INPUT_DIR, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Cover must live next to its post (${inputPath}): ${cover}`);
    }
    return `/${relative.split(path.sep).join("/")}`;
  });

  eleventyConfig.addFilter("autoExcerpt", (post) => {
    if (post.data.excerpt) return String(post.data.excerpt).trim();
    const raw = post.rawInput || readFileSync(post.inputPath, "utf8");
    const body = String(raw).replace(/^---[\s\S]*?---/, "");
    const text = body
      .replace(/!\[[^\]]*]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_`>#]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const chars = Array.from(text);
    if (chars.length <= 46) return text;
    return `${chars.slice(0, 46).join("")}…`;
  });

  eleventyConfig.amendLibrary("md", (md) => {
    const previous = md.renderer.rules.image;
    md.renderer.rules.image = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const src = token.attrGet("src") || "";
      if (/^https?:\/\//i.test(src) || src.startsWith("//")) {
        throw new Error(`External images are not allowed: ${src}`);
      }
      if (!token.attrGet("loading")) token.attrSet("loading", "lazy");
      if (!token.attrGet("decoding")) token.attrSet("decoding", "async");
      if (!token.attrGet("sizes")) {
        token.attrSet("sizes", "(min-width: 760px) 676px, calc(100vw - 44px)");
      }
      if (previous) return previous(tokens, idx, options, env, self);
      return self.renderToken(tokens, idx, options);
    };
  });

  eleventyConfig.addCollection("posts", (api) => {
    const posts = api.getFilteredByGlob("src/posts/**/*.md").filter((post) => !post.data.draft);
    for (const post of posts) {
      if (!post.data.title) throw new Error(`Post is missing title: ${post.inputPath}`);
      if (post.data.cover && !post.data.coverAlt) {
        throw new Error(`Post is missing coverAlt: ${post.inputPath}`);
      }
      if (!post.data.cover && post.data.coverAlt) {
        throw new Error(`coverAlt requires a cover: ${post.inputPath}`);
      }
      if (!(post.date instanceof Date) || Number.isNaN(post.date.getTime())) {
        throw new Error(`Post is missing date: ${post.inputPath}`);
      }
      if (post.data.category != null && typeof post.data.category !== "string") {
        throw new Error(`category must be a string: ${post.inputPath}`);
      }
      assertBvid(post.data.bvid, post.inputPath);
      assertNoExternalUrls(post.inputPath);
    }
    return posts.sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("chapters", (api) => {
    const books = loadBooks();
    const ids = new Set(books.map((book) => book.id));
    const chapters = api.getFilteredByGlob("src/chapters/**/*.md").filter((chapter) => !chapter.data.draft);
    const seen = new Set();
    for (const chapter of chapters) {
      if (!chapter.data.title) throw new Error(`Chapter is missing title: ${chapter.inputPath}`);
      if (!ids.has(chapter.data.book)) {
        throw new Error(`Chapter book must match an id in src/_data/books.json: ${chapter.inputPath}`);
      }
      if (!Number.isInteger(chapter.data.chapter) || chapter.data.chapter < 1) {
        throw new Error(`chapter must be a positive integer: ${chapter.inputPath}`);
      }
      if (!(chapter.date instanceof Date) || Number.isNaN(chapter.date.getTime())) {
        throw new Error(`Chapter is missing date: ${chapter.inputPath}`);
      }
      const key = `${chapter.data.book}:${chapter.data.chapter}`;
      if (seen.has(key)) {
        throw new Error(`Duplicate chapter ${chapter.data.chapter} for book ${chapter.data.book}`);
      }
      seen.add(key);
      assertBvid(chapter.data.bvid, chapter.inputPath);
      assertNoExternalUrls(chapter.inputPath);
    }
    return chapters.sort((a, b) => {
      if (a.data.book !== b.data.book) return String(a.data.book).localeCompare(String(b.data.book));
      return a.data.chapter - b.data.chapter;
    });
  });

  // Reserved for a later sections nav. v1 renders nothing from this.
  // Add `category: 生活` to a post and it will show up here, newest first.
  eleventyConfig.addCollection("categories", (api) => {
    const groups = new Map();
    for (const post of api.getFilteredByGlob("src/posts/**/*.md")) {
      if (post.data.draft || !post.data.category) continue;
      const name = String(post.data.category).trim();
      if (!name) continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(post);
    }
    return [...groups.entries()]
      .map(([name, posts]) => ({
        name,
        posts: posts.sort((a, b) => b.date - a.date),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans"));
  });
}

export const config = {
  pathPrefix: PATH_PREFIX,
  markdownTemplateEngine: false,
  htmlTemplateEngine: "njk",
  dir: {
    input: "src",
    includes: "_includes",
    data: "_data",
    output: "_site",
  },
};
