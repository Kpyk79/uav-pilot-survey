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
  var listEl = document.getElementById("list");
  var statsEl = document.getElementById("stats");

  var rows = [];

  function labelMap(dict, key) { return dict[key] || key || "—"; }
  var RESIDENCE = { own: "За місцем проживання", needs_housing: "Потребує житла", rent: "Оренда поблизу", other: "Інше" };
  var AVAILABILITY = { full: "Повна готовність", partial: "Часткова", limited: "Обмежена" };
  var VISION = { normal: "Норма", corrected: "З корекцією", impaired: "Обмеження" };

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return d.toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function render() {
    var q = document.getElementById("search").value.trim().toLowerCase();
    var sortBy = document.getElementById("sortBy").value;

    var withScore = rows.map(function (r) {
      return { row: r, ch: window.buildCharacteristic(r) };
    });

    var filtered = withScore.filter(function (x) {
      if (!q) return true;
      var hay = [x.row.full_name, x.row.region, x.row.phone, x.row.email].join(" ").toLowerCase();
      return hay.includes(q);
    });

    filtered.sort(function (a, b) {
      switch (sortBy) {
        case "created_at_asc": return new Date(a.row.created_at) - new Date(b.row.created_at);
        case "score_desc": return b.ch.score - a.ch.score;
        case "name_asc": return (a.row.full_name || "").localeCompare(b.row.full_name || "", "uk");
        default: return new Date(b.row.created_at) - new Date(a.row.created_at);
      }
    });

    statsEl.innerHTML =
      stat(rows.length, "Усього анкет") +
      stat(rows.filter(function (r) { return window.buildCharacteristic(r).score >= 70; }).length, "Високий потенціал") +
      stat(rows.filter(function (r) { return r.residence_type === "needs_housing"; }).length, "Потребують житла");

    if (!filtered.length) {
      listEl.innerHTML = '<div class="empty">Анкет не знайдено.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(function (x) {
      var r = x.row, ch = x.ch;
      var scoreClass = ch.score >= 70 ? "is-high" : ch.score < 40 ? "is-low" : "";
      return (
        '<article class="card" data-id="' + r.id + '">' +
          '<div class="card__score ' + scoreClass + '">' + ch.score + "</div>" +
          '<div class="card__main">' +
            "<h3>" + escapeHtml(r.full_name || "Без імені") + "</h3>" +
            '<div class="card__meta">' + fmtDate(r.created_at) + " · " + escapeHtml(r.phone || "") + " · " + escapeHtml(r.region || "") + "</div>" +
            '<div class="card__tags">' + ch.tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; }).join("") + "</div>" +
            '<div class="card__detail">' + detailHtml(r) + "</div>" +
          "</div>" +
          '<button type="button" class="btn btn--ghost card__toggle">Деталі</button>' +
        "</article>"
      );
    }).join("");

    Array.prototype.forEach.call(listEl.querySelectorAll(".card__toggle"), function (btn) {
      btn.addEventListener("click", function () { btn.closest(".card").classList.toggle("is-open"); });
    });
  }

  function stat(value, label) {
    return '<div class="stat"><span class="stat__value">' + value + '</span><span class="stat__label">' + label + "</span></div>";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function detailHtml(r) {
    var lines = [
      "Проживання: " + labelMap(RESIDENCE, r.residence_type) + (r.residence_note ? " — " + r.residence_note : ""),
      "Email: " + (r.email || "—"),
      "Дата народження: " + (r.birth_date || "—"),
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
