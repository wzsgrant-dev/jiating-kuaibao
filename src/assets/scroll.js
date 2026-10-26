(function () {
  var root = document.documentElement;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.querySelectorAll(".post-body > *, .post-toolbar-bottom, .site-footer").forEach(function (node) {
      node.classList.add("reveal");
    });

    var nodes = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!nodes.length) return;

    function revealInRange() {
      var viewport = window.innerHeight || root.clientHeight;
      nodes.forEach(function (node) {
        if (node.classList.contains("is-in")) return;
        var rect = node.getBoundingClientRect();
        // Anything already on screen, or scrolled past, stays visible.
        if (rect.top < viewport * 0.92) node.classList.add("is-in");
      });
    }

    revealInRange();
    window.addEventListener("scroll", revealInRange, { passive: true });
    window.addEventListener("resize", revealInRange);
    root.classList.add("js");
  } catch (error) {
    root.classList.remove("js");
  }
})();
