(function () {
  "use strict";

  var client = null;
  if (window.supabase && window.SUPABASE_CONFIG && !window.SUPABASE_CONFIG.url.includes("YOUR-PROJECT")) {
    client = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  }

  var loginBox = document.getElementById("loginBox");
  var dashboard = document.getElementById("dashboard");
  var logoutBtn = document.getElementById("logoutBtn");
  var loginForm = document.getElementById("loginForm");
  var loginError = document.getElementById("loginError");
  var groupsEl = document.getElementById("groups");
  var statsEl = document.getElementById("stats");

  var rows = [];

  function labelMap(dict, key) { return dict[key] || key || "—"; }
  var VISION = { normal: "Норма", corrected: "З корекцією", impaired: "Обмеження" };

  function dateKey(iso) {
    var d = new Date(iso);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD, групування за днем подання
  }
  function fmtDateHeading(key) {
    var d = new Date(key + "T00:00:00");
    return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" });
  }
  function fmtTime(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function groupByDate(list) {
    var map = {};
    list.forEach(function (r) {
      var k = dateKey(r.created_at);
      (map[k] = map[k] || []).push(r);
    });
    return Object.keys(map).sort(function (a, b) { return b.localeCompare(a); }).map(function (k) {
      return { key: k, items: map[k] };
    });
  }

  function render() {
    var q = document.getElementById("search").value.trim().toLowerCase();
    var sortBy = document.getElementById("sortBy").value;

    var withScore = rows.map(function (r) { return { row: r, ch: window.buildCharacteristic(r) }; });

    var filtered = withScore.filter(function (x) {
      if (!q) return true;
      var hay = [x.row.full_name, x.row.region, x.row.phone, x.row.email].join(" ").toLowerCase();
      return hay.includes(q);
    });

    var sorter = {
      created_at_asc: function (a, b) { return new Date(a.row.created_at) - new Date(b.row.created_at); },
      score_desc: function (a, b) { return b.ch.score - a.ch.score; },
      name_asc: function (a, b) { return (a.row.full_name || "").localeCompare(b.row.full_name || "", "uk"); },
      created_at_desc: function (a, b) { return new Date(b.row.created_at) - new Date(a.row.created_at); },
    }[sortBy] || function (a, b) { return new Date(b.row.created_at) - new Date(a.row.created_at); };

    statsEl.innerHTML =
      stat(rows.length, "Усього анкет") +
      stat(rows.filter(function (r) { return window.buildCharacteristic(r).score >= 70; }).length, "Високий потенціал") +
      stat(rows.filter(function (r) { return r.uav_experience; }).length, "З досвідом БпЛА");

    if (!filtered.length) {
      groupsEl.innerHTML = '<div class="empty">Анкет не знайдено.</div>';
      return;
    }

    var groups = groupByDate(filtered.map(function (x) { return x.row; }));

    groupsEl.innerHTML = groups.map(function (g, i) {
      var items = g.items.slice().sort(function (a, b) {
        return sorter({ row: a, ch: window.buildCharacteristic(a) }, { row: b, ch: window.buildCharacteristic(b) });
      });
      return (
        '<details class="group"' + (i === 0 ? " open" : "") + '>' +
          '<summary class="group__head"><span class="group__date">' + fmtDateHeading(g.key) + '</span>' +
            '<span class="group__count">' + items.length + " анкет" + (items.length === 1 ? "а" : items.length < 5 ? "и" : "") + "</span>" +
            '<button type="button" class="btn btn--ghost group__table-btn" data-date-key="' + g.key + '">Таблиця</button>' +
          "</summary>" +
          '<div class="group__list">' +
            items.map(rowHtml).join("") +
          "</div>" +
        "</details>"
      );
    }).join("");

    Array.prototype.forEach.call(groupsEl.querySelectorAll(".row"), function (btn) {
      btn.addEventListener("click", function () {
        var r = rows.find(function (x) { return String(x.id) === btn.dataset.id; });
        if (r) openModal(r);
      });
    });

    Array.prototype.forEach.call(groupsEl.querySelectorAll(".group__table-btn"), function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var key = btn.dataset.dateKey;
        var group = groups.find(function (g) { return g.key === key; });
        if (group) openTableModal(key, group.items);
      });
    });
  }

  function rowHtml(r) {
    var ch = window.buildCharacteristic(r);
    var scoreClass = ch.score >= 70 ? "is-high" : ch.score < 40 ? "is-low" : "";
    return (
      '<button type="button" class="row" data-id="' + r.id + '">' +
        '<span class="row__score ' + scoreClass + '">' + ch.score + "</span>" +
        '<span class="row__name">' + escapeHtml(r.full_name || "Без імені") + "</span>" +
        '<span class="row__tags">' + ch.tags.slice(0, 2).map(function (t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; }).join("") + "</span>" +
        '<span class="row__time">' + fmtTime(r.created_at) + "</span>" +
      "</button>"
    );
  }

  function stat(value, label) {
    return '<div class="stat"><span class="stat__value">' + value + '</span><span class="stat__label">' + label + "</span></div>";
  }

  function detailHtml(r) {
    var lines = [
      "Адреса проживання на час зборів: " + (r.residence_type || "—"),
      "Телефон: " + (r.phone || "—"),
      "Email: " + (r.email || "—"),
      "Дата народження: " + (r.birth_date || "—"),
      "Область: " + (r.region || "—"),
      "Статус: " + (r.status === "military" ? "Військовослужбовець" + (r.unit ? " (" + r.unit + ")" : "") : "Цивільний"),
      "Освіта: " + (r.education_level || "—") + (r.education_field ? ", " + r.education_field : ""),
      "Досвід БпЛА: " + (r.uav_experience ? "так — " + ((r.uav_types || []).join(", ") || "—") + (r.uav_hours ? " (" + r.uav_hours + ")" : "") : "ні"),
      "RC-досвід: " + (r.rc_experience ? r.rc_details || "так" : "ні"),
      "Симулятори: " + (r.sim_experience ? r.sim_details || "так" : "ні"),
      "Навички — електроніка/програмування/ремонт: " + [r.skill_electronics, r.skill_programming, r.skill_repair].join(" / "),
      "Водійські категорії: " + ((r.driver_license || []).join(", ") || "—"),
      "Зір: " + labelMap(VISION, r.vision) + (r.health_limitations ? " — " + r.health_limitations : ""),
      "Стресостійкість: " + (r.stress_resilience || "—") + "/5",
      "Мотивація: " + (r.motivation || "—"),
      "Контактна особа: " + (r.contact_person || "—"),
      "Додатково: " + (r.additional_info || "—"),
    ];
    return lines.map(escapeHtml).join("\n");
  }

  // ---------- modal ----------
  var modal = document.getElementById("modal");
  var modalScore = document.getElementById("modalScore");
  var modalName = document.getElementById("modalName");
  var modalMeta = document.getElementById("modalMeta");
  var modalTags = document.getElementById("modalTags");
  var modalDetail = document.getElementById("modalDetail");
  var lastFocused = null;

  function openModal(r) {
    var ch = window.buildCharacteristic(r);
    var scoreClass = ch.score >= 70 ? "is-high" : ch.score < 40 ? "is-low" : "";
    modalScore.textContent = ch.score;
    modalScore.className = "modal__score " + scoreClass;
    modalName.textContent = r.full_name || "Без імені";
    modalMeta.textContent = fmtDateHeading(dateKey(r.created_at)) + " · " + fmtTime(r.created_at) + " · " + ch.level;
    modalTags.innerHTML = ch.tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; }).join("");
    modalDetail.textContent = detailHtml(r);
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.getElementById("modalClose").focus();
  }
  function closeModal() {
    modal.hidden = true;
    if (lastFocused) lastFocused.focus();
  }
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!modal.hidden) closeModal();
    if (!tableModal.hidden) closeTableModal();
  });

  // ---------- per-date table ----------
  var tableModal = document.getElementById("tableModal");
  var tableModalTitle = document.getElementById("tableModalTitle");
  var dataTable = document.getElementById("dataTable");
  var tableLastFocused = null;
  var currentTableItems = [];
  var currentTableDateLabel = "";

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

  function openTableModal(dateKeyStr, items) {
    currentTableItems = items.slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    currentTableDateLabel = fmtDateHeading(dateKeyStr);
    tableModalTitle.textContent = "Таблиця кандидатів — " + currentTableDateLabel;
    renderDataTable(currentTableItems);
    tableLastFocused = document.activeElement;
    tableModal.hidden = false;
    document.getElementById("tableModalClose").focus();
  }
  function closeTableModal() {
    tableModal.hidden = true;
    if (tableLastFocused) tableLastFocused.focus();
  }
  document.getElementById("tableModalClose").addEventListener("click", closeTableModal);
  document.getElementById("tableModalBackdrop").addEventListener("click", closeTableModal);
  document.getElementById("tablePrintBtn").addEventListener("click", function () { window.print(); });
  document.getElementById("tableExportBtn").addEventListener("click", function () {
    var cols = TABLE_COLUMNS;
    var esc = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    var out = [cols.map(function (c) { return esc(c.label); }).join(",")];
    currentTableItems.forEach(function (r, i) {
      out.push(cols.map(function (c) { return esc(c.get(r, i)); }).join(","));
    });
    var blob = new Blob(["﻿" + out.join("\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "candidates_" + currentTableDateLabel.replace(/\s+/g, "_") + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  async function loadRows() {
    if (!client) return;
    var res = await client.from("candidates").select("*").order("created_at", { ascending: false });
    if (res.error) { console.error(res.error); return; }
    rows = res.data || [];
    render();
  }

  function toCsv() {
    if (!rows.length) return "";
    var cols = Object.keys(rows[0]);
    var esc = function (v) {
      if (v == null) return "";
      if (Array.isArray(v)) v = v.join("|");
      v = String(v).replace(/"/g, '""');
      return '"' + v + '"';
    };
    var out = [cols.join(",")];
    rows.forEach(function (r) { out.push(cols.map(function (c) { return esc(r[c]); }).join(",")); });
    return out.join("\n");
  }

  document.getElementById("exportBtn").addEventListener("click", function () {
    var csv = toCsv();
    if (!csv) return;
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "candidates_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("refreshBtn").addEventListener("click", loadRows);
  document.getElementById("search").addEventListener("input", render);
  document.getElementById("sortBy").addEventListener("change", render);

  function enterDashboard() {
    loginBox.hidden = true;
    dashboard.hidden = false;
    logoutBtn.hidden = false;
    loadRows();
  }
  function enterLogin() {
    loginBox.hidden = false;
    dashboard.hidden = true;
    logoutBtn.hidden = true;
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
    enterLogin();
  });

  (async function init() {
    if (!client) { enterLogin(); return; }
    var session = await client.auth.getSession();
    if (session.data.session) enterDashboard();
    else enterLogin();
  })();
})();
