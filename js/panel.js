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
  var RESIDENCE = { own: "За місцем проживання", needs_housing: "Потребує житла", rent: "Оренда поблизу", other: "Інше" };
  var AVAILABILITY = { full: "Повна готовність", partial: "Часткова", limited: "Обмежена" };
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
      stat(rows.filter(function (r) { return r.residence_type === "needs_housing"; }).length, "Потребують житла");

    if (!filtered.length) {
      groupsEl.innerHTML = '<div class="empty">Анкет не знайдено.</div>';
      return;
    }

    var groups = groupByDate(filtered.map(function (x) { return x.row; }));

    groupsEl.innerHTML = groups.map(function (g) {
      var items = g.items.slice().sort(function (a, b) {
        return sorter({ row: a, ch: window.buildCharacteristic(a) }, { row: b, ch: window.buildCharacteristic(b) });
      });
      return (
        '<section class="group">' +
          '<div class="group__head"><span class="group__date">' + fmtDateHeading(g.key) + '</span>' +
            '<span class="group__count">' + items.length + " анкет" + (items.length === 1 ? "а" : items.length < 5 ? "и" : "") + "</span></div>" +
          '<div class="group__list">' +
            items.map(rowHtml).join("") +
          "</div>" +
        "</section>"
      );
    }).join("");

    Array.prototype.forEach.call(groupsEl.querySelectorAll(".row"), function (btn) {
      btn.addEventListener("click", function () {
        var r = rows.find(function (x) { return String(x.id) === btn.dataset.id; });
        if (r) openModal(r);
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
      "Проживання: " + labelMap(RESIDENCE, r.residence_type) + (r.residence_note ? " — " + r.residence_note : ""),
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
      "Стресостійкість: " + (r.stress_resilience || "—") + "/5" + (r.stress_example ? " — " + r.stress_example : ""),
      "Мотивація: " + (r.motivation || "—"),
      "Готовність: " + labelMap(AVAILABILITY, r.availability) + (r.availability_note ? " — " + r.availability_note : ""),
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
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });

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
