// Прості графіки без бібліотек: стовпчики, горизонтальні смуги, бублики + спільна підказка при наведенні.
// Підписи завжди вставляються через textContent (дані з анкет не довіряємо). Мітки мають aria-label, тож дані доступні без наведення.
(function () {
  "use strict";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /** Круглий «гарний» максимум осі для лічильників (кратний 2). */
  function niceMax(m) {
    if (m <= 4) return 4;
    for (var p = 1; ; p *= 10) {
      var steps = [4, 6, 8, 10];
      for (var i = 0; i < steps.length; i++) if (steps[i] * p >= m) return steps[i] * p;
    }
  }

  // ---------- підказка ----------
  var tip = null;
  function showTip(target, x, y) {
    if (!tip) tip = document.getElementById("tip");
    if (!tip) return;
    tip.textContent = "";
    var v = el("b", null, target.getAttribute("data-v"));
    var t = el("span", null, target.getAttribute("data-t"));
    tip.append(v, t);
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8);
    var top = y - h - 14 < 8 ? y + 18 : y - h - 14;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }
  function hideTip() { if (tip) tip.hidden = true; }
  document.addEventListener("pointermove", function (e) {
    var t = e.target.closest ? e.target.closest("[data-v]") : null;
    if (t) showTip(t, e.clientX, e.clientY); else hideTip();
  });
  document.addEventListener("pointerleave", hideTip);
  document.addEventListener("scroll", hideTip, true);
  document.addEventListener("focusin", function (e) {
    var t = e.target.closest ? e.target.closest("[data-v]") : null;
    if (!t) return;
    var r = t.getBoundingClientRect();
    showTip(t, r.left + r.width / 2, r.top);
  });
  document.addEventListener("focusout", hideTip);

  function mark(node, title, value) {
    node.setAttribute("data-t", title);
    node.setAttribute("data-v", value);
    node.setAttribute("tabindex", "0");
    node.setAttribute("aria-label", title + ": " + value);
    return node;
  }

  /**
   * Стовпчики. data: [{label, value, title, tipValue}], xLabels: підписи під віссю (або "all" — під кожним стовпчиком).
   * Значення над стовпчиками підписуємо лише коли їх мало (або для максимального).
   */
  function columns(data, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([0]));
    var top = niceMax(max);
    var plot = el("div", "plot");
    var ticks = el("div", "plot__y");
    [top, top / 2, 0].forEach(function (t) { ticks.append(el("span", null, String(t))); });
    var area = el("div", "plot__area");
    var grid = el("div", "plot__grid");
    for (var g = 0; g < 3; g++) grid.append(el("i"));
    var cols = el("div", "cols");
    var labelAll = data.length <= 10;
    data.forEach(function (d, i) {
      var c = el("div", "col");
      var bar = el("i", d.value ? "" : "z");
      bar.style.height = (d.value / top * 100) + "%";
      bar.style.setProperty("--i", String(i));
      c.append(bar);
      if (d.value && (labelAll || d.value === max)) {
        var b = el("b", null, String(d.value));
        b.style.bottom = "calc(" + (d.value / top * 100) + "% + 3px)";
        c.append(b);
      }
      mark(c, d.title || d.label, d.tipValue || String(d.value));
      cols.append(c);
    });
    area.append(grid, cols);
    plot.append(ticks, area);
    var x = el("div", "plot__x" + (opts.xAll ? " plot__x--cols" : ""));
    if (opts.xAll) data.forEach(function (d) { x.append(el("span", null, d.label)); });
    else {
      var n = data.length;
      var idx = n <= 1 ? [0] : n <= 6 ? data.map(function (_, i) { return i; }) : [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1];
      idx.forEach(function (i) { x.append(el("span", null, data[i].label)); });
    }
    plot.append(x);
    return plot;
  }

  /** Горизонтальні смуги. rows: [{label, value, text, title, tipValue}], max — значення, що відповідає повній смузі. */
  function hbars(rows, max) {
    var wrap = el("div", "hbars");
    var m = max || Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    rows.forEach(function (r, i) {
      var row = el("div", "hb");
      row.append(el("span", "hb__l", r.label));
      var track = el("div", "hb__t");
      var fill = el("div", "hb__f");
      fill.style.width = Math.max(0, Math.min(100, r.value / m * 100)) + "%";
      fill.style.setProperty("--i", String(i));
      track.append(fill);
      row.append(track, el("span", "hb__v", r.text != null ? r.text : String(r.value)));
      mark(row, r.title || r.label, r.tipValue || (r.text != null ? r.text : String(r.value)));
      wrap.append(row);
    });
    return wrap;
  }

  /** Бублик. segments: [{label, value, color}] (color — CSS-колір або var()). */
  function donut(segments, centerValue, centerLabel) {
    var total = segments.reduce(function (s, x) { return s + x.value; }, 0);
    var R = 60, C = 2 * Math.PI * R, gap = 2;
    var wrap = el("div", "donut");
    var holder = el("div", "donut__wrap");
    var svg = svgEl("svg", { viewBox: "0 0 150 150", "aria-hidden": "false", role: "img" });
    svg.append(svgEl("circle", { "class": "track", cx: 75, cy: 75, r: R }));
    var acc = 0;
    segments.forEach(function (s) {
      if (!s.value || !total) return;
      var len = s.value / total * C;
      var seg = svgEl("circle", { "class": "seg", cx: 75, cy: 75, r: R });
      seg.style.stroke = s.color;
      var visible = segments.filter(function (x) { return x.value; }).length > 1 ? Math.max(0, len - gap) : len;
      seg.setAttribute("stroke-dasharray", visible + " " + (C - visible));
      seg.setAttribute("stroke-dashoffset", String(-acc));
      mark(seg, s.label, s.value + " (" + Math.round(s.value / total * 100) + "%)");
      svg.append(seg);
      acc += len;
    });
    var mid = el("div", "donut__mid");
    mid.append(el("b", null, String(centerValue)), el("span", null, centerLabel || ""));
    holder.append(svg, mid);
    var leg = el("div", "leg");
    segments.forEach(function (s) {
      var row = el("div");
      var sw = el("i"); sw.style.background = s.color;
      row.append(sw, el("span", null, s.label), el("b", null, String(s.value)), el("small", null, total ? Math.round(s.value / total * 100) + "%" : "0%"));
      leg.append(row);
    });
    wrap.append(holder, leg);
    return wrap;
  }

  window.Charts = { columns: columns, hbars: hbars, donut: donut, niceMax: niceMax };
})();
