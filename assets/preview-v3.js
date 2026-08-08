"use strict";
document.documentElement.classList.add("motion-ready");
document.addEventListener("DOMContentLoaded", function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var header = document.getElementById("siteHeader");
  var progress = document.getElementById("readingProgress");
  var menuButton = document.getElementById("menuButton");
  var mainNav = document.getElementById("mainNav");
  var hero = document.querySelector(".hero");
  var frame = document.querySelector(".glass-frame");
  var rafPending = false;

  function updateScrollState() {
    header.classList.toggle("scrolled", window.scrollY > 18);
    var maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    progress.style.width = Math.min(100, window.scrollY / maximum * 100).toFixed(2) + "%";
  }
  updateScrollState();
  window.addEventListener("scroll", updateScrollState, { passive: true });

  menuButton.addEventListener("click", function () {
    var open = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(open));
    mainNav.classList.toggle("open", open);
  });
  mainNav.addEventListener("click", function (event) {
    if (!event.target.closest("a")) return;
    menuButton.setAttribute("aria-expanded", "false");
    mainNav.classList.remove("open");
  });

  function fillBars(root) {
    root.querySelectorAll(".skill u[data-width]").forEach(function (bar) { bar.style.width = bar.getAttribute("data-width"); });
  }
  function animateCount(element) {
    if (element.dataset.animated) return;
    element.dataset.animated = "true";
    var target = Number(element.getAttribute("data-count"));
    var suffix = element.getAttribute("data-suffix") || "";
    if (reduceMotion) { element.textContent = target + suffix; return; }
    var started = performance.now();
    function tick(now) {
      var progressValue = Math.min(1, (now - started) / 720);
      var eased = 1 - Math.pow(1 - progressValue, 3);
      element.textContent = Math.round(target * eased) + suffix;
      if (progressValue < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (reduceMotion || !("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach(function (item) { item.classList.add("visible"); });
    document.querySelectorAll("[data-count]").forEach(animateCount);
    fillBars(document);
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        entry.target.querySelectorAll("[data-count]").forEach(animateCount);
        if (entry.target.matches("[data-count]")) animateCount(entry.target);
        fillBars(entry.target);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .14, rootMargin: "0px 0px -7%" });
    document.querySelectorAll(".reveal").forEach(function (item) { revealObserver.observe(item); });
  }
  window.setTimeout(function () { fillBars(document.querySelector(".product-stage")); }, reduceMotion ? 0 : 720);

  if (!reduceMotion && finePointer && hero && frame) {
    hero.addEventListener("pointermove", function (event) {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () {
        var bounds = hero.getBoundingClientRect();
        var x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        var y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
        hero.style.setProperty("--mouse-x", (x * 100).toFixed(1) + "%");
        hero.style.setProperty("--mouse-y", (y * 100).toFixed(1) + "%");
        hero.style.setProperty("--parallax-x", ((x - .5) * 18).toFixed(1) + "px");
        hero.style.setProperty("--parallax-y", ((y - .5) * 14).toFixed(1) + "px");
        hero.style.setProperty("--parallax-x-reverse", ((.5 - x) * 9.9).toFixed(1) + "px");
        hero.style.setProperty("--parallax-y-reverse", ((.5 - y) * 7.7).toFixed(1) + "px");
        hero.style.setProperty("--tilt-x", ((.5 - y) * 3.2).toFixed(2) + "deg");
        hero.style.setProperty("--tilt-y", ((x - .5) * 4.2).toFixed(2) + "deg");
        rafPending = false;
      });
    });
    hero.addEventListener("pointerleave", function () {
      hero.style.setProperty("--mouse-x", "50%"); hero.style.setProperty("--mouse-y", "38%");
      hero.style.setProperty("--parallax-x", "0px"); hero.style.setProperty("--parallax-y", "0px");
      hero.style.setProperty("--parallax-x-reverse", "0px"); hero.style.setProperty("--parallax-y-reverse", "0px");
      hero.style.setProperty("--tilt-x", "0deg"); hero.style.setProperty("--tilt-y", "0deg");
    });
  }

  var processSteps = Array.from(document.querySelectorAll("[data-process-step]"));
  if (processSteps.length) {
    processSteps[0].classList.add("active");
    if (!reduceMotion && "IntersectionObserver" in window) {
      var processObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          processSteps.forEach(function (step) { step.classList.toggle("active", step === entry.target); });
        });
      }, { threshold: .58, rootMargin: "-18% 0px -32%" });
      processSteps.forEach(function (step) { processObserver.observe(step); });
    }
  }

  document.querySelectorAll("details").forEach(function (details) {
    details.addEventListener("toggle", function () {
      if (!details.open) return;
      document.querySelectorAll("details[open]").forEach(function (other) { if (other !== details) other.open = false; });
    });
  });

  var navSections = ["roles", "how", "ranking"];
  if ("IntersectionObserver" in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        mainNav.querySelectorAll("a[href^='#']").forEach(function (link) { link.classList.toggle("active", link.getAttribute("href") === "#" + entry.target.id); });
      });
    }, { threshold: .15, rootMargin: "-30% 0px -55%" });
    navSections.forEach(function (id) { var section = document.getElementById(id); if (section) navObserver.observe(section); });
  }
});
