export default {
  layout: "chapter.njk",
  tags: ["chapter"],
  eleventyComputed: {
    permalink: (data) => {
      if (data.draft) return false;
      return `/books/${data.book}/${data.chapter}/`;
    },
  },
};
