import path from "node:path";
import { readFileSync } from "node:fs";
import { HtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { PATH_PREFIX } from "./scripts/prefix.js";

const INPUT_DIR = path.resolve("src");

function stripPrefix(url) {
  if (!url || PATH_PREFIX === "/") return url || "";
  if (url === PATH_PREFIX || url === PATH_PREFIX.slice(0, -1)) return "/";
  if (url.startsWith(PATH_PREFIX)) return `/${url.slice(PATH_PREFIX.length)}`;
  return url;
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

  eleventyConfig.addFilter("unprefix", (url) => stripPrefix(url));

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
      if (!post.data.cover) throw new Error(`Post is missing cover: ${post.inputPath}`);
      if (!post.data.coverAlt) throw new Error(`Post is missing coverAlt: ${post.inputPath}`);
      if (!(post.date instanceof Date) || Number.isNaN(post.date.getTime())) {
        throw new Error(`Post is missing date: ${post.inputPath}`);
      }
      if (post.data.category != null && typeof post.data.category !== "string") {
        throw new Error(`category must be a string: ${post.inputPath}`);
      }
      const raw = readFileSync(post.inputPath, "utf8");
      if (/https?:\/\//i.test(raw) || /(?:src|href)\s*=\s*["']\/\//i.test(raw)) {
        throw new Error(`External URLs are not allowed in ${post.inputPath}`);
      }
    }
    return posts.sort((a, b) => b.date - a.date);
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
