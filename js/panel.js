(function () {
  "use strict";

  var client = null;
  if (window.supabase && window.SUPABASE_CONFIG && !window.SUPABASE_CONFIG.url.includes("YOUR-PROJECT")) {
    client = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  }

  var $ = function (id) { return document.getElementById(id); };
  var loginBox = $("loginBox"), dashboard = $("dashboard"), logoutBtn = $("logoutBtn"), tabsEl = $("tabs");
  var loginForm = $("loginForm"), loginError = $("loginError");
  var groupsEl = $("groups"), statsEl = $("stats"), kpisEl = $("kpis"), chartsEl = $("charts");

  var rows = [];
  var tab = "list";
  try { tab = localStorage.getItem("hq-tab") === "stats" ? "stats" : "list"; } catch (e) { /* ignore */ }

  // ---------- довідники ----------
  var VISION = { normal: "Норма", corrected: "З корекцією", impaired: "Обмеження" };
  var PERCEPTION = { practice: "Через практику", theory: "Через теорію", observation: "Через спостереження", mixed: "Однаково добре по-різному" };
  var EDU = { secondary: "Повна загальна середня", vocational: "Професійно-технічна", bachelor: "Бакалавр", master: "Магістр / спеціаліст", other: "Інше" };
  var UAV_TYPES = { fpv: "FPV-дрон", multirotor: "Мультикоптер", fixed_wing: "Літак (крило)", vtol: "VTOL" };
  function labelMap(dict, key) { return dict[key] || key || "—"; }

  // ---------- дати й рядки ----------
  // День подання за місцевим часом (як і в застосунку Ocinka), а не за UTC
  function dateKey(iso) {
    var d = new Date(iso), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function fmtDateHeading(key) {
    return new Date(key + "T00:00:00").toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" });
  }
  function fmtShort(key) { return new Date(key + "T00:00:00").toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }); }
  function fmtTime(iso) { return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }); }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function ringClass(score) { return score >= 70 ? "" : score < 40 ? " is-low" : " is-mid"; }
  function ringHtml(score, size) {
    return '<span class="ring' + (size ? " ring--" + size : "") + ringClass(score) + '" style="--p:' + score + '"><span>' + score + "</span></span>";
  }
  function groupByDate(list) {
    var map = {};
    list.forEach(function (r) { var k = dateKey(r.created_at); (map[k] = map[k] || []).push(r); });
    return Object.keys(map).sort(function (a, b) { return b.localeCompare(a); }).map(function (k) { return { key: k, items: map[k] }; });
  }

  // ---------- фільтри ----------
  function inPeriod(r) {
    var p = $("period").value;
    if (p === "all") return true;
    if (p === "today") return dateKey(r.created_at) === dateKey(new Date().toISOString());
    return Date.now() - new Date(r.created_at).getTime() <= Number(p) * 86400000;
  }
  function periodRows() { return rows.filter(inPeriod); }
  function withScore(list) { return list.map(function (r) { return { row: r, ch: window.buildCharacteristic(r) }; }); }

  // ---------- вкладки ----------
  function setTab(next) {
    tab = next;
    try { localStorage.setItem("hq-tab", tab); } catch (e) { /* ignore */ }
    Array.prototype.forEach.call(tabsEl.querySelectorAll(".tab"), function (b) {
      var on = b.dataset.tab === tab;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("viewList").hidden = tab !== "list";
    $("viewStats").hidden = tab !== "stats";
    Array.prototype.forEach.call(document.querySelectorAll("[data-for]"), function (n) { n.hidden = n.dataset.for !== tab; });
    render();
  }
  tabsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".tab");
    if (b) setTab(b.dataset.tab);
  });

  function render() { if (tab === "stats") renderAnalytics(); else renderList(); }

  // ---------- вкладка «Кандидати» ----------
  function stat(value, label, i) {
    return '<div class="stat" style="animation-delay:' + i * 50 + 'ms"><span class="stat__value">' + value + '</span><span class="stat__label">' + label + "</span></div>";
  }

  function renderList() {
    var q = $("search").value.trim().toLowerCase();
    var sortBy = $("sortBy").value, only = $("onlyFilter").value;
    var base = withScore(periodRows());

    var avg = base.length ? Math.round(base.reduce(function (s, x) { return s + x.ch.score; }, 0) / base.length) : 0;
    statsEl.innerHTML =
      stat(base.length, "Усього анкет", 0) +
      stat(base.filter(function (x) { return x.ch.score >= 70; }).length, "Високий потенціал", 1) +
      stat(base.filter(function (x) { return x.row.uav_experience; }).length, "З досвідом БпЛА", 2) +
      stat(avg, "Середній рейтинг", 3);

    var filtered = base.filter(function (x) {
      if (only === "high" && x.ch.score < 70) return false;
      if (only === "uav" && !x.row.uav_experience) return false;
      if (only === "military" && x.row.status !== "military") return false;
      if (only === "civilian" && x.row.status === "military") return false;
      if (!q) return true;
      return [x.row.full_name, x.row.region, x.row.phone, x.row.email].join(" ").toLowerCase().includes(q);
    });

    var sorter = {
      created_at_asc: function (a, b) { return new Date(a.row.created_at) - new Date(b.row.created_at); },
      score_desc: function (a, b) { return b.ch.score - a.ch.score; },
      name_asc: function (a, b) { return (a.row.full_name || "").localeCompare(b.row.full_name || "", "uk"); },
      created_at_desc: function (a, b) { return new Date(b.row.created_at) - new Date(a.row.created_at); },
    }[sortBy] || function (a, b) { return new Date(b.row.created_at) - new Date(a.row.created_at); };

    if (!filtered.length) {
      groupsEl.innerHTML = '<div class="empty">Анкет не знайдено.</div>';
      return;
    }
    var groups = groupByDate(filtered.map(function (x) { return x.row; }));
    var chOf = {};
    filtered.forEach(function (x) { chOf[x.row.id] = x.ch; });

    groupsEl.innerHTML = groups.map(function (g, i) {
      var items = g.items.slice().sort(function (a, b) { return sorter({ row: a, ch: chOf[a.id] }, { row: b, ch: chOf[b.id] }); });
      return (
        '<details class="group"' + (i === 0 ? " open" : "") + '>' +
          '<summary class="group__head"><span class="group__date">' + fmtDateHeading(g.key) + '</span>' +
            '<span class="group__count">' + items.length + " " + plural(items.length, "анкета", "анкети", "анкет") + "</span>" +
            '<span class="group__actions">' +
              '<button type="button" class="btn small group__table-btn" data-date-key="' + g.key + '">Таблиця</button>' +
              '<button type="button" class="btn small group__docx-btn" data-date-key="' + g.key + '">Досьє .docx</button>' +
              '<button type="button" class="btn small danger group__del-btn" data-date-key="' + g.key + '">Видалити день</button>' +
            "</span>" +
          "</summary>" +
          '<div class="group__list">' + items.map(function (r) { return rowHtml(r, chOf[r.id]); }).join("") + "</div>" +
        "</details>"
      );
    }).join("");

    Array.prototype.forEach.call(groupsEl.querySelectorAll(".row"), function (btn) {
      btn.addEventListener("click", function () { openById(btn.dataset.id); });
    });
    function bindGroupButton(selector, handler) {
      Array.prototype.forEach.call(groupsEl.querySelectorAll(selector), function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var group = groups.find(function (g) { return g.key === btn.dataset.dateKey; });
          if (group) handler(group, btn);
        });
      });
    }
    bindGroupButton(".group__table-btn", function (g) { openTableModal(g.key, g.items); });
    bindGroupButton(".group__docx-btn", function (g, btn) { exportDossiers(g.items, fmtDateHeading(g.key), "dosye_" + g.key, btn); });
    bindGroupButton(".group__del-btn", function (g) {
      if (!confirm("Видалити ВСІ анкети за " + fmtDateHeading(g.key) + " (" + g.items.length + " шт.)?\n\nДію неможливо скасувати. Спершу варто завантажити досьє або CSV.")) return;
      deleteRows(g.items.map(function (r) { return r.id; }));
    });
  }

  function rowHtml(r, ch) {
    var meta = [r.status === "military" ? "військовий" : "цивільний", r.region].filter(Boolean).join(" · ");
    return (
      '<button type="button" class="row" data-id="' + escapeHtml(r.id) + '">' +
        ringHtml(ch.score) +
        '<span class="row__main"><span class="row__name">' + escapeHtml(r.full_name || "Без імені") + "</span>" +
          '<span class="row__tags">' + ch.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; }).join("") + "</span></span>" +
        '<span class="row__time">' + escapeHtml(meta) + '<i class="nl"></i>' + fmtTime(r.created_at) + "</span>" +
      "</button>"
    );
  }

  function openById(id) {
    var r = rows.find(function (x) { return String(x.id) === String(id); });
    if (r) openModal(r);
  }

  // ---------- вкладка «Аналітика» ----------
  var pct = function (n, total) { return total ? Math.round(n / total * 100) : 0; };

  function card(title, sub, body, cls, i) {
    var c = document.createElement("section");
    c.className = "chart" + (cls ? " " + cls : "");
    c.style.setProperty("--i", String(i));
    var h = document.createElement("h3"); h.textContent = title;
    var s = document.createElement("p"); s.className = "sub"; s.textContent = sub || "";
    c.append(h, s);
    c.append(body);
    return c;
  }
  function note(text) { var d = document.createElement("div"); d.className = "nodata"; d.textContent = text; return d; }
  function kpi(value, label, extra, hero, i) {
    var d = document.createElement("div");
    d.className = "kpi" + (hero ? " kpi--hero" : "");
    d.style.animationDelay = i * 50 + "ms";
    var v = document.createElement("span"); v.className = "kpi__v"; v.textContent = value;
    var l = document.createElement("span"); l.className = "kpi__l"; l.textContent = label;
    d.append(v, l);
    if (extra) { var e = document.createElement("small"); e.textContent = extra; d.append(e); }
    return d;
  }
  function counts(list, fn) {
    var m = {};
    list.forEach(function (x) { var k = fn(x); if (k != null && k !== "") m[k] = (m[k] || 0) + 1; });
    return m;
  }

  function renderAnalytics() {
    var items = withScore(periodRows());
    var total = items.length;
    kpisEl.textContent = ""; chartsEl.textContent = "";
    if (!total) {
      var empty = document.createElement("div"); empty.className = "empty"; empty.textContent = "За обраний період анкет немає.";
      chartsEl.append(empty);
      return;
    }
    var avg = Math.round(items.reduce(function (s, x) { return s + x.ch.score; }, 0) / total);
    var high = items.filter(function (x) { return x.ch.score >= 70; }).length;
    var mid = items.filter(function (x) { return x.ch.score >= 40 && x.ch.score < 70; }).length;
    var low = total - high - mid;
    var uav = items.filter(function (x) { return x.row.uav_experience; }).length;
    var mil = items.filter(function (x) { return x.row.status === "military"; }).length;
    var week = items.filter(function (x) { return Date.now() - new Date(x.row.created_at).getTime() <= 7 * 86400000; }).length;

    kpisEl.append(
      kpi(String(total), "Усього анкет", week + " за останні 7 днів", true, 0),
      kpi(String(avg), "Середній рейтинг", "із 100 балів", false, 1),
      kpi(pct(high, total) + "%", "Високий потенціал", high + " " + plural(high, "кандидат", "кандидати", "кандидатів"), false, 2),
      kpi(pct(uav, total) + "%", "З досвідом БпЛА", uav + " " + plural(uav, "кандидат", "кандидати", "кандидатів"), false, 3),
      kpi(pct(mil, total) + "%", "Військовослужбовці", mil + " " + plural(mil, "кандидат", "кандидати", "кандидатів"), false, 4)
    );

    var n = 0;
    var add = function (c) { chartsEl.append(c); };

    // 1. Анкети за днями (безперервна шкала дат)
    var byDay = counts(items, function (x) { return dateKey(x.row.created_at); });
    var keys = Object.keys(byDay).sort();
    var first = new Date(keys[0] + "T00:00:00Z"), last = new Date(keys[keys.length - 1] + "T00:00:00Z");
    var span = Math.round((last - first) / 86400000) + 1;
    var from = span > 45 ? new Date(last.getTime() - 44 * 86400000) : first;
    var days = [];
    for (var d = new Date(from); d <= last; d = new Date(d.getTime() + 86400000)) {
      var k = d.toISOString().slice(0, 10);
      var v = byDay[k] || 0;
      days.push({ label: fmtShort(k), value: v, title: fmtDateHeading(k), tipValue: v + " " + plural(v, "анкета", "анкети", "анкет") });
    }
    add(card("Анкети за днями", span > 45 ? "Останні 45 днів" : "Скільки анкет подано щодня", window.Charts.columns(days), "w12", n++));

    // 2. Розподіл рейтингу
    var buckets = [[0, 19], [20, 39], [40, 59], [60, 79], [80, 100]].map(function (b) {
      var c = items.filter(function (x) { return x.ch.score >= b[0] && x.ch.score <= b[1]; }).length;
      return { label: b[0] + "–" + b[1], value: c, title: "Рейтинг " + b[0] + "–" + b[1], tipValue: c + " " + plural(c, "кандидат", "кандидати", "кандидатів") };
    });
    add(card("Розподіл рейтингу", "Кількість кандидатів за балами", window.Charts.columns(buckets, { xAll: true }), "", n++));

    // 3. Потенціал
    var olive = "var(--pri)";
    add(card("Потенціал кандидатів", "Високий від 70 балів, середній від 40", window.Charts.donut([
      { label: "Високий потенціал", value: high, color: olive },
      { label: "Середній потенціал", value: mid, color: "color-mix(in oklab, var(--pri) 62%, var(--surface))" },
      { label: "Потребує додаткової оцінки", value: low, color: "color-mix(in oklab, var(--pri) 38%, var(--surface))" },
    ], total, "анкет"), "", n++));

    // 4. Статус (дві категорії: кольори палітри 1 і 2)
    add(card("Статус", "Військовослужбовці й цивільні", window.Charts.donut([
      { label: "Військовослужбовці", value: mil, color: "var(--c1)" },
      { label: "Цивільні", value: total - mil, color: "var(--c2)" },
    ], pct(mil, total) + "%", "військових"), "w4", n++));

    // 5. Досвід
    var rc = items.filter(function (x) { return x.row.rc_experience; }).length;
    var sim = items.filter(function (x) { return x.row.sim_experience; }).length;
    var expRows = [["Керували БпЛА", uav], ["RC-моделі", rc], ["Авіасимулятори", sim]].map(function (a) {
      return { label: a[0], value: a[1], text: pct(a[1], total) + "%", title: a[0], tipValue: a[1] + " з " + total + " (" + pct(a[1], total) + "%)" };
    });
    add(card("Досвід кандидатів", "Частка кандидатів", window.Charts.hbars(expRows, total), "w4", n++));

    // 6. Типи апаратів
    var typeCount = {};
    items.forEach(function (x) { if (x.row.uav_experience) (x.row.uav_types || []).forEach(function (t) { typeCount[t] = (typeCount[t] || 0) + 1; }); });
    var typeRows = Object.keys(UAV_TYPES).map(function (t) {
      var c = typeCount[t] || 0;
      return { label: UAV_TYPES[t], value: c, text: String(c), title: UAV_TYPES[t], tipValue: c + " " + plural(c, "кандидат", "кандидати", "кандидатів") };
    });
    add(card("Типи апаратів", uav ? "Серед " + uav + " " + plural(uav, "кандидата", "кандидатів", "кандидатів") + " з досвідом БпЛА" : "Немає кандидатів із досвідом БпЛА",
      uav ? window.Charts.hbars(typeRows) : note("Поки ніхто не вказав досвід керування БпЛА."), "w4", n++));

    // 7. Технічні навички
    function avgOf(f) { return items.reduce(function (s, x) { return s + (Number(x.row[f]) || 0); }, 0) / total; }
    var skillRows = [["Електроніка", "skill_electronics"], ["Програмування", "skill_programming"], ["Ремонт техніки", "skill_repair"]].map(function (a) {
      var v = avgOf(a[1]);
      return { label: a[0], value: v, text: v.toFixed(1).replace(".", ","), title: a[0], tipValue: "в середньому " + v.toFixed(1).replace(".", ",") + " із 3" };
    });
    add(card("Технічні навички", "Середня самооцінка від 0 до 3", window.Charts.hbars(skillRows, 3), "", n++));

    // 8. Стресостійкість
    var stressCount = counts(items.filter(function (x) { return x.row.stress_resilience > 0; }), function (x) { return x.row.stress_resilience; });
    var stress = [1, 2, 3, 4, 5].map(function (s) {
      var c = stressCount[s] || 0;
      return { label: String(s), value: c, title: "Стресостійкість " + s + " з 5", tipValue: c + " " + plural(c, "кандидат", "кандидати", "кандидатів") };
    });
    add(card("Стресостійкість", "Самооцінка від 1 до 5", window.Charts.columns(stress, { xAll: true }), "", n++));

    // 9. Освіта
    var eduCount = counts(items, function (x) { return x.row.education_level; });
    var eduRows = Object.keys(EDU).filter(function (k) { return eduCount[k]; }).map(function (k) {
      return { label: EDU[k], value: eduCount[k], text: String(eduCount[k]), title: EDU[k], tipValue: eduCount[k] + " (" + pct(eduCount[k], total) + "%)" };
    });
    add(card("Освіта", "Рівень освіти кандидатів", eduRows.length ? window.Charts.hbars(eduRows) : note("Освіту ніхто не вказав."), "w4", n++));

    // 10. Області (топ-8, регістр і пробіли не мають значення)
    var regionCount = {}, regionName = {};
    items.forEach(function (x) {
      var raw = (x.row.region || "").trim();
      if (!raw) return;
      var key = raw.toLowerCase();
      regionCount[key] = (regionCount[key] || 0) + 1;
      if (!regionName[key]) regionName[key] = raw.charAt(0).toUpperCase() + raw.slice(1);
    });
    var regionKeys = Object.keys(regionCount).sort(function (a, b) { return regionCount[b] - regionCount[a]; });
    var regionRows = regionKeys.slice(0, 8).map(function (k) {
      return { label: regionName[k], value: regionCount[k], text: String(regionCount[k]), title: regionName[k], tipValue: regionCount[k] + " " + plural(regionCount[k], "кандидат", "кандидати", "кандидатів") };
    });
    add(card("Звідки кандидати", regionKeys.length > 8 ? "Топ-8 із " + regionKeys.length + " варіантів" : "Область / населений пункт",
      regionRows.length ? window.Charts.hbars(regionRows) : note("Регіон ніхто не вказав."), "w4", n++));

    // 11. Водійські категорії та зір
    var lic = ["A", "B", "C", "D"].map(function (c) {
      var k = items.filter(function (x) { return (x.row.driver_license || []).indexOf(c) >= 0; }).length;
      return { label: "Категорія " + c, value: k, text: String(k), title: "Категорія " + c, tipValue: k + " (" + pct(k, total) + "%)" };
    });
    add(card("Водійські категорії", "Кількість кандидатів із посвідченням", window.Charts.hbars(lic, Math.max(1, total)), "w4", n++));

    var visionCount = counts(items, function (x) { return x.row.vision; });
    var visionRows = Object.keys(VISION).filter(function (k) { return visionCount[k]; }).map(function (k) {
      return { label: VISION[k], value: visionCount[k], text: String(visionCount[k]), title: "Зір: " + VISION[k], tipValue: visionCount[k] + " (" + pct(visionCount[k], total) + "%)" };
    });
    add(card("Зір", "Самооцінка кандидатів", visionRows.length ? window.Charts.hbars(visionRows, total) : note("Зір ніхто не вказав."), "w4", n++));

    // 12. Потребують уваги
    var flagged = items.map(function (x) {
      var why = [];
      if (x.row.vision === "impaired") why.push("обмеження зору");
      if (x.row.health_limitations && String(x.row.health_limitations).trim()) why.push("здоров’я: " + String(x.row.health_limitations).trim());
      if (x.row.stress_resilience > 0 && x.row.stress_resilience <= 2) why.push("низька стресостійкість");
      return { x: x, why: why };
    }).filter(function (f) { return f.why.length; });
    add(card("Потребують уваги", flagged.length ? flagged.length + " " + plural(flagged.length, "кандидат", "кандидати", "кандидатів") + " із зауваженнями" : "Зауважень немає",
      flagged.length ? miniList(flagged.slice(0, 6).map(function (f) { return { x: f.x, sub: f.why.join("; ") }; }), flagged.length - 6) : note("Ніхто не вказав обмежень."), "w4", n++));

    // 13. Топ кандидатів
    var top = items.slice().sort(function (a, b) { return b.ch.score - a.ch.score || new Date(a.row.created_at) - new Date(b.row.created_at); }).slice(0, 5);
    add(card("Найвищий рейтинг", "Топ-5 кандидатів", miniList(top.map(function (x) { return { x: x, sub: x.ch.level }; }), 0), "w4", n++));
  }

  function miniList(list, more) {
    var wrap = document.createElement("div");
    wrap.className = "mini";
    list.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "mrow"; b.dataset.id = it.x.row.id;
      b.innerHTML = ringHtml(it.x.ch.score, "sm");
      var name = document.createElement("span"); name.className = "mrow__n";
      name.textContent = it.x.row.full_name || "Без імені";
      var sub = document.createElement("small"); sub.textContent = it.sub; name.append(sub);
      var when = document.createElement("span"); when.className = "mrow__r"; when.textContent = fmtShort(dateKey(it.x.row.created_at));
      b.append(name, when);
      b.addEventListener("click", function () { openById(b.dataset.id); });
      wrap.append(b);
    });
    if (more > 0) { var m = document.createElement("div"); m.className = "nodata"; m.textContent = "…і ще " + more; wrap.append(m); }
    return wrap;
  }

  // ---------- картка кандидата ----------
  var modal = $("modal"), modalRow = null, lastFocused = null;

  function detailPairs(r) {
    var types = (r.uav_types || []).map(function (t) { return UAV_TYPES[t] || t; }).join(", ");
    return [
      ["Адреса на час зборів", r.residence_type], ["Телефон", r.phone], ["Email", r.email], ["Дата народження", r.birth_date], ["Область", r.region],
      ["Статус", r.status === "military" ? "Військовослужбовець" + (r.unit ? " (" + r.unit + ")" : "") : "Цивільний"],
      ["Строк служби", r.approx_service_years], ["Посада / спеціальність", r.position_specialty], ["Профільні курси", r.profile_courses],
      ["Досвід з технікою", r.equipment_experience], ["Навчав(ла) інших", r.trained_others ? (r.trained_others_details || "так") : "ні"],
      ["Нагороди", r.awards], ["Освіта", (EDU[r.education_level] || r.education_level || "—") + (r.education_field ? ", " + r.education_field : "")],
      ["Досвід БпЛА", r.uav_experience ? "так — " + (types || "—") + (r.uav_hours ? " (" + r.uav_hours + ")" : "") : "ні"],
      ["RC-досвід", r.rc_experience ? r.rc_details || "так" : "ні"], ["Симулятори", r.sim_experience ? r.sim_details || "так" : "ні"],
      ["Навички (електроніка / програмування / ремонт)", [r.skill_electronics, r.skill_programming, r.skill_repair].join(" / ")],
      ["Водійські категорії", (r.driver_license || []).join(", ")],
      ["Зір", labelMap(VISION, r.vision) + (r.health_limitations ? " — " + r.health_limitations : "")],
      ["Стресостійкість", (r.stress_resilience || "—") + "/5"],
      ["Хобі / захоплення", r.hobbies], ["Сприйняття інформації", labelMap(PERCEPTION, r.info_perception)],
      ["Риси характеру", r.character_traits], ["Теми для розмови", r.talk_topics],
      ["Мотивація", r.motivation], ["Контактна особа", r.contact_person], ["Додатково", r.additional_info],
    ];
  }

  function openModal(r) {
    modalRow = r;
    var ch = window.buildCharacteristic(r);
    var ring = $("modalScore");
    ring.className = "ring ring--lg" + ringClass(ch.score);
    ring.style.setProperty("--p", ch.score);
    ring.innerHTML = "<span>" + ch.score + "</span>";
    $("modalName").textContent = r.full_name || "Без імені";
    $("modalMeta").textContent = fmtDateHeading(dateKey(r.created_at)) + " · " + fmtTime(r.created_at) + " · " + ch.level;
    $("modalTags").innerHTML = ch.tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; }).join("");
    var detail = $("modalDetail");
    detail.textContent = "";
    var dl = document.createElement("dl"); dl.style.margin = "0";
    detailPairs(r).forEach(function (p) {
      var row = document.createElement("div"); row.className = "drow";
      var dt = document.createElement("dt"); dt.textContent = p[0];
      var dd = document.createElement("dd"); dd.textContent = p[1] == null || String(p[1]).trim() === "" ? "—" : String(p[1]);
      row.append(dt, dd); dl.append(row);
    });
    detail.append(dl);
    var sum = document.createElement("div"); sum.className = "dsum";
    var sh = document.createElement("b"); sh.textContent = "Підсумок для інструктора";
    sum.append(sh, document.createTextNode(window.buildSummary(r)));
    detail.append(sum);
    lastFocused = document.activeElement;
    modal.hidden = false;
    $("modalClose").focus();
  }
  function closeModal() { modal.hidden = true; if (lastFocused && lastFocused.focus) lastFocused.focus(); }
  $("modalDocx").addEventListener("click", function (e) {
    if (modalRow) exportDossiers([modalRow], null, "dosye_" + window.Dossier.safeName(modalRow.full_name) + "_" + dateKey(modalRow.created_at), e.currentTarget);
  });
  $("modalDelete").addEventListener("click", async function () {
    if (!modalRow) return;
    if (!confirm("Видалити анкету «" + (modalRow.full_name || "Без імені") + "»?\n\nДію неможливо скасувати.")) return;
    if (await deleteRows([modalRow.id])) closeModal();
  });
  $("modalClose").addEventListener("click", closeModal);
  $("modalBackdrop").addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!modal.hidden) closeModal();
    if (!tableModal.hidden) closeTableModal();
  });

  // ---------- таблиця за датою ----------
  var tableModal = $("tableModal"), dataTable = $("dataTable");
  var tableLastFocused = null, currentTableItems = [], currentTableDateLabel = "";

  var TABLE_COLUMNS = [
    { label: "№", get: function (r, i) { return i + 1; } },
    { label: "ПІБ", get: function (r) { return r.full_name || "—"; } },
    { label: "Рейтинг", get: function (r) { return window.buildCharacteristic(r).score; } },
    { label: "Телефон", get: function (r) { return r.phone || "—"; } },
    { label: "Адреса на час зборів", get: function (r) { return r.residence_type || "—"; } },
    { label: "Область", get: function (r) { return r.region || "—"; } },
    { label: "Статус", get: function (r) { return r.status === "military" ? "Військовослужбовець" : "Цивільний"; } },
    { label: "Досвід БпЛА", get: function (r) { return r.uav_experience ? "так" : "ні"; } },
    { label: "Навички Е/П/Р", get: function (r) { return [r.skill_electronics, r.skill_programming, r.skill_repair].join("/"); } },
    { label: "Зір", get: function (r) { return labelMap(VISION, r.vision); } },
    { label: "Стресостійкість", get: function (r) { return (r.stress_resilience || "—") + "/5"; } },
    { label: "Мотивація", get: function (r) { return r.motivation || "—"; } },
  ];

  function renderDataTable(items) {
    var thead = "<thead><tr>" + TABLE_COLUMNS.map(function (c) { return "<th>" + escapeHtml(c.label) + "</th>"; }).join("") + "</tr></thead>";
    var tbody = "<tbody>" + items.map(function (r, i) {
      return "<tr>" + TABLE_COLUMNS.map(function (c) { return "<td>" + escapeHtml(String(c.get(r, i))) + "</td>"; }).join("") + "</tr>";
    }).join("") + "</tbody>";
    dataTable.innerHTML = thead + tbody;
  }
  function openTableModal(key, items) {
    currentTableItems = items.slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    currentTableDateLabel = fmtDateHeading(key);
    $("tableModalTitle").textContent = "Таблиця кандидатів — " + currentTableDateLabel;
    renderDataTable(currentTableItems);
    tableLastFocused = document.activeElement;
    tableModal.hidden = false;
    $("tableModalClose").focus();
  }
  function closeTableModal() { tableModal.hidden = true; if (tableLastFocused && tableLastFocused.focus) tableLastFocused.focus(); }
  $("tableModalClose").addEventListener("click", closeTableModal);
  $("tableModalBackdrop").addEventListener("click", closeTableModal);
  $("tablePrintBtn").addEventListener("click", function () { window.print(); });
  $("tableDocxBtn").addEventListener("click", function (e) {
    exportDossiers(currentTableItems, currentTableDateLabel, "dosye_" + currentTableDateLabel.replace(/\s+/g, "_"), e.currentTarget);
  });
  $("tableExportBtn").addEventListener("click", function () {
    var esc = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    var out = [TABLE_COLUMNS.map(function (c) { return esc(c.label); }).join(",")];
    currentTableItems.forEach(function (r, i) { out.push(TABLE_COLUMNS.map(function (c) { return esc(c.get(r, i)); }).join(",")); });
    downloadBlob(new Blob(["﻿" + out.join("\n")], { type: "text/csv;charset=utf-8;" }), "candidates_" + currentTableDateLabel.replace(/\s+/g, "_") + ".csv");
  });

  // ---------- повідомлення, завантаження файлів ----------
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 6000);
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  // Досьє в .docx: одна анкета або всі анкети дня (зі зведенням на першій сторінці)
  async function exportDossiers(items, title, fileBase, btn) {
    if (!items || !items.length) return;
    if (!window.docx || !window.Dossier) { toast("Не вдалося завантажити модуль експорту. Перевірте з'єднання й оновіть сторінку."); return; }
    var label = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Готуємо…"; }
    try {
      var sorted = items.slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      downloadBlob(await window.Dossier.toBlob(sorted, title ? { title: title } : {}), fileBase + ".docx");
    } catch (err) {
      console.error(err);
      toast("Не вдалося сформувати файл .docx.");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  // Видалення: повертаємо видалені рядки, щоб помітити заборону політикою RLS (вона мовчки видаляє 0 рядків)
  async function deleteRows(ids) {
    if (!client || !ids.length) return false;
    var res = await client.from("candidates").delete().in("id", ids).select("id");
    if (res.error) { console.error(res.error); toast("Не вдалося видалити: " + res.error.message); return false; }
    var removed = (res.data || []).map(function (x) { return String(x.id); });
    rows = rows.filter(function (r) { return removed.indexOf(String(r.id)) < 0; });
    render();
    if (!removed.length) {
      toast("База не дозволила видалення. Виконайте supabase/delete-policy.sql у Supabase (SQL Editor).");
      return false;
    }
    if (removed.length < ids.length) toast("Видалено " + removed.length + " з " + ids.length + " анкет. Перевірте дозволи в Supabase.");
    else toast(removed.length === 1 ? "Анкету видалено" : "Видалено анкет: " + removed.length);
    return true;
  }

  // ---------- дані ----------
  async function loadRows() {
    if (!client) return;
    var res = await client.from("candidates").select("*").order("created_at", { ascending: false });
    if (res.error) { console.error(res.error); toast("Не вдалося завантажити анкети."); return; }
    rows = res.data || [];
    render();
  }

  function toCsv() {
    if (!rows.length) return "";
    var cols = Object.keys(rows[0]);
    var esc = function (v) {
      if (v == null) return "";
      if (Array.isArray(v)) v = v.join("|");
      return '"' + String(v).replace(/"/g, '""') + '"';
    };
    var out = [cols.join(",")];
    rows.forEach(function (r) { out.push(cols.map(function (c) { return esc(r[c]); }).join(",")); });
    return out.join("\n");
  }
  $("exportBtn").addEventListener("click", function () {
    var csv = toCsv();
    if (csv) downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), "candidates_" + new Date().toISOString().slice(0, 10) + ".csv");
  });
  $("refreshBtn").addEventListener("click", loadRows);
  ["search", "sortBy", "onlyFilter", "period"].forEach(function (id) { $(id).addEventListener(id === "search" ? "input" : "change", render); });

  // ---------- вхід ----------
  function enterDashboard() {
    loginBox.hidden = true; dashboard.hidden = false; logoutBtn.hidden = false; tabsEl.hidden = false;
    setTab(tab);
    loadRows();
  }
  function enterLogin() {
    loginBox.hidden = false; dashboard.hidden = true; logoutBtn.hidden = true; tabsEl.hidden = true;
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    loginError.hidden = true;
    if (!client) {
      loginError.textContent = "Панель ще не підключено до Supabase. Заповніть js/config.js.";
      loginError.hidden = false;
      return;
    }
    var fd = new FormData(loginForm);
    var res = await client.auth.signInWithPassword({ email: fd.get("email"), password: fd.get("password") });
    if (res.error) {
      loginError.textContent = "Невірний email або пароль.";
      loginError.hidden = false;
      return;
    }
    enterDashboard();
  });
  logoutBtn.addEventListener("click", async function () {
    if (client) await client.auth.signOut();
    rows = [];
    enterLogin();
  });

  (async function init() {
    if (!client) { enterLogin(); return; }
    var session = await client.auth.getSession();
    if (session.data.session) enterDashboard();
    else enterLogin();
  })();
})();
