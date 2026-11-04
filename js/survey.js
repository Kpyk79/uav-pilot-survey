/* Анкета-квест: одне запитання на екран, етапи, плавні переходи, чернетка на пристрої.
   Поля й значення відповідають таблиці candidates (supabase/schema.sql); скоринг рахується в js/characteristics.js. */
(function () {
  "use strict";

  var DRAFT_KEY = "uav-survey-v2";
  var DRY_RUN = /[?&]dry=1/.test(location.search); // перевірка без відправлення в базу
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var STAGES = [
    ["👋", "Знайомство"], ["🧭", "Твій шлях"], ["🚁", "У небі"], ["🛠", "Майстерня"],
    ["🫀", "Самопочуття"], ["🧩", "Особистість"], ["🏁", "Фінал"],
  ];

  // ---------- допоміжне ----------
  function yearsOf(text) { var m = String(text || "").match(/\d+/); return m ? parseInt(m[0], 10) : 0; }
  function phoneOk(v) { return String(v || "").replace(/\D/g, "").length >= 9; }
  function emailOk(v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  var isMil = function (a) { return a.status === "military"; };
  var isSenior = function (a) { return isMil(a) && yearsOf(a.approx_service_years) > 5; };

  var SKILL = [[0, "Поки ні", 0], [1, "Базово", 1], [2, "Впевнено", 2], [3, "Профі", 3]];
  var STRESS = [[1, "Дуже хвилююсь", 1], [2, "Інколи гублюсь", 2], [3, "Нормально", 3], [4, "Тримаю себе в руках", 4], [5, "Спокійний як скеля", 5]];

  // ---------- сценарій квесту ----------
  // st — номер етапу; fields: text|tel|email|date|textarea|choice|yesno|multi|scale|consent;
  // options: [значення, емодзі, підпис, пояснення]; optional — можна пропустити; auto — перехід одразу після вибору.
  var SCREENS = [
    { id: "name", st: 0, guide: "Привіт! Почнемо знайомство.", title: "Як вас звати?", fields: [
      { name: "full_name", type: "text", label: "Прізвище, ім’я, по батькові", req: true, max: 150, ac: "name" },
      { name: "birth_date", type: "date", label: "Дата народження (необов’язково)" }] },
    { id: "contact", st: 0, guide: "Щоб ми змогли з вами зв’язатися.", title: "Ваші контакти", fields: [
      { name: "phone", type: "tel", label: "Телефон", req: true, ph: "+380 __ ___ __ __", ac: "tel", check: phoneOk, err: "Вкажіть номер телефону повністю" },
      { name: "email", type: "email", label: "Email (необов’язково)", ac: "email", check: emailOk, err: "Схоже, email введено з помилкою" }] },
    { id: "region", st: 0, optional: true, guide: "Просто щоб знати, звідки ви.", title: "Звідки ви?", hint: "Область і населений пункт, де живете постійно", fields: [
      { name: "region", type: "text", label: "Область / населений пункт", max: 150 }] },
    { id: "residence", st: 0, guide: "Це потрібно для організації зборів.", title: "Де житимете під час зборів?", hint: "Вкажіть повну адресу", fields: [
      { name: "residence_type", type: "text", label: "Адреса проживання", req: true, max: 300 }] },

    { id: "status", st: 1, optional: true, auto: true, guide: "Тепер трохи про ваш шлях.", title: "Ви на службі чи цивільний?", fields: [
      { name: "status", type: "choice", options: [["civilian", "🙂", "Цивільна особа"], ["military", "🎖", "Військовослужбовець"]] }] },
    { id: "unit", st: 1, optional: true, when: isMil, title: "У якому підрозділі служите?", fields: [
      { name: "unit", type: "text", label: "Військова частина / підрозділ", max: 200 }] },
    { id: "years", st: 1, optional: true, when: isMil, title: "Скільки приблизно служите?", fields: [
      { name: "approx_service_years", type: "text", label: "Приблизний строк служби", ph: "наприклад: 7 років", max: 60 }] },
    { id: "senior1", st: 1, optional: true, when: isSenior, guide: "У вас великий досвід, розкажіть про нього детальніше.", title: "Посада та підготовка", fields: [
      { name: "position_specialty", type: "text", label: "Посада / спеціальність", max: 200 },
      { name: "profile_courses", type: "text", label: "Профільні курси / підготовка", max: 300 }] },
    { id: "senior2", st: 1, optional: true, when: isSenior, title: "З якою технікою працювали?", fields: [
      { name: "equipment_experience", type: "text", label: "Досвід роботи з технікою / обладнанням", max: 300 }] },
    { id: "senior3", st: 1, auto: true, when: isSenior, title: "Чи доводилось навчати або інструктувати інших?", fields: [
      { name: "trained_others", type: "yesno" }] },
    { id: "senior4", st: 1, optional: true, when: function (a) { return isSenior(a) && a.trained_others === true; }, title: "Кого і чого навчали?", fields: [
      { name: "trained_others_details", type: "text", label: "Кого і чого навчав(ла)", max: 300 }] },
    { id: "senior5", st: 1, optional: true, when: isSenior, title: "Є нагороди чи відзнаки?", fields: [
      { name: "awards", type: "text", label: "Нагороди / відзнаки", max: 300 }] },
    { id: "edu", st: 1, optional: true, auto: true, title: "Яка у вас освіта?", fields: [
      { name: "education_level", type: "choice", options: [
        ["secondary", "🎒", "Повна загальна середня"], ["vocational", "🔧", "Професійно-технічна"],
        ["bachelor", "🎓", "Бакалавр"], ["master", "🏛", "Магістр / спеціаліст"], ["other", "📚", "Інше"]] }] },
    { id: "edu2", st: 1, optional: true, when: function (a) { return !!a.education_level; }, title: "За яким напрямом?", fields: [
      { name: "education_field", type: "text", label: "Спеціальність / напрям", max: 200 }] },

    { id: "uav", st: 2, auto: true, guide: "Тепер про небо. Тут немає «правильних» відповідей.", title: "Чи доводилось керувати БпЛА?", fields: [
      { name: "uav_experience", type: "yesno" }] },
    { id: "uav2", st: 2, optional: true, when: function (a) { return a.uav_experience === true; }, title: "Якими апаратами керували?", hint: "Можна вибрати кілька", fields: [
      { name: "uav_types", type: "multi", options: [["fpv", "🚀", "FPV-дрон"], ["multirotor", "🚁", "Мультикоптер (DJI тощо)"], ["fixed_wing", "✈️", "Літак (крило)"], ["vtol", "🛩", "VTOL"]] }] },
    { id: "uav3", st: 2, optional: true, when: function (a) { return a.uav_experience === true; }, title: "Скільки приблизно літали?", fields: [
      { name: "uav_hours", type: "text", label: "Орієнтовний наліт (годин) або кількість вильотів", max: 120 }] },
    { id: "rc", st: 2, auto: true, title: "А RC-моделі чи авіамодельний спорт?", fields: [{ name: "rc_experience", type: "yesno" }] },
    { id: "rc2", st: 2, optional: true, when: function (a) { return a.rc_experience === true; }, title: "Розкажіть про моделі", fields: [
      { name: "rc_details", type: "text", label: "Тип моделей, стаж", max: 300 }] },
    { id: "sim", st: 2, auto: true, title: "Літали на симуляторах?", hint: "Наприклад Liftoff, Velocidrone", fields: [{ name: "sim_experience", type: "yesno" }] },
    { id: "sim2", st: 2, optional: true, when: function (a) { return a.sim_experience === true; }, title: "Які саме і як часто?", fields: [
      { name: "sim_details", type: "text", label: "Які симулятори / як часто", max: 300 }] },

    { id: "sk1", st: 3, auto: true, guide: "Оцініть себе чесно. Це лише допоможе підібрати навчання.", title: "Електроніка та радіотехніка", hint: "Паяльник, схеми, антени, радіозв’язок", fields: [
      { name: "skill_electronics", type: "scale", options: SKILL }] },
    { id: "sk2", st: 3, auto: true, title: "Програмування та налаштування систем", hint: "Прошивки, конфігуратори, скрипти", fields: [
      { name: "skill_programming", type: "scale", options: SKILL }] },
    { id: "sk3", st: 3, auto: true, title: "Ремонт і обслуговування техніки", hint: "Збирати, лагодити, діагностувати", fields: [
      { name: "skill_repair", type: "scale", options: SKILL }] },
    { id: "lic", st: 3, optional: true, title: "Водійські категорії", hint: "Якщо є, відмітьте всі", fields: [
      { name: "driver_license", type: "multi", options: [["A", "🏍", "A"], ["B", "🚗", "B"], ["C", "🚚", "C"], ["D", "🚌", "D"]] }] },

    { id: "vision", st: 4, optional: true, auto: true, guide: "Кілька запитань про самопочуття. Відповідайте так, як є.", title: "Як ваш зір?", fields: [
      { name: "vision", type: "choice", options: [
        ["normal", "👀", "Нормальний", "без корекції"], ["corrected", "👓", "З корекцією", "окуляри чи лінзи"], ["impaired", "🩺", "Є суттєві обмеження"]] }] },
    { id: "health", st: 4, optional: true, title: "Чи є щось зі здоров’я, про що варто знати?", hint: "Якщо ні, просто пропустіть. Це потрібно лише для підбору навантаження.", fields: [
      { name: "health_limitations", type: "textarea", label: "Обмеження за станом здоров’я", max: 500 }] },
    { id: "stress", st: 4, auto: true, title: "Як ви поводитесь під тиском?", hint: "Оцініть себе у складних, гарячих ситуаціях", fields: [
      { name: "stress_resilience", type: "scale", options: STRESS }] },

    { id: "hobby", st: 5, optional: true, guide: "Тут можна розслабитись. Це допоможе нам краще вас пізнати.", title: "Чим захоплюєтесь?", fields: [
      { name: "hobbies", type: "text", label: "Хобі / захоплення", max: 300 }] },
    { id: "learn", st: 5, optional: true, auto: true, title: "Як вам найлегше вчитись?", fields: [
      { name: "info_perception", type: "choice", options: [
        ["practice", "🤲", "Через практику", "щоб потримати руками"], ["theory", "📖", "Через пояснення", "теорія, розповідь"],
        ["observation", "👁", "Через спостереження", "дивитись, як роблять інші"], ["mixed", "🔀", "По-різному", "залежить від теми"]] }] },
    { id: "traits", st: 5, optional: true, title: "Які риси характеру в собі цінуєте?", fields: [
      { name: "character_traits", type: "text", label: "Риси характеру", max: 300 }] },
    { id: "talk", st: 5, optional: true, title: "Про що любите говорити поза службою?", fields: [
      { name: "talk_topics", type: "text", label: "Теми та інтереси", max: 300 }] },

    { id: "why", st: 6, guide: "Останній ривок. Ви майже на фініші!", title: "Чому ви хочете стати пілотом БпЛА?", hint: "Своїми словами, кількох речень достатньо", fields: [
      { name: "motivation", type: "textarea", label: "Ваша мотивація", req: true, max: 800 }] },
    { id: "extra", st: 6, optional: true, title: "Ще щось важливе?", fields: [
      { name: "contact_person", type: "text", label: "Контактна особа командування (ПІБ, телефон), якщо застосовно", max: 300 },
      { name: "additional_info", type: "textarea", label: "Додаткова інформація", max: 500 }] },
    { id: "consent", st: 6, final: true, title: "Залишилась одна дія", hint: "Після підтвердження анкету буде відправлено.", fields: [{ name: "consent", type: "consent", req: true }] },
  ];

  // ---------- стан ----------
  var A = {};          // відповіді (ключі = колонки таблиці)
  var current = null;  // id поточного екрана або null (вступ)
  var hist = [];       // пройдені екрани для кнопки «Назад»
  var lastStage = -1;
  var busy = false;

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d && d.A && typeof d.A === "object") { A = d.A; current = d.cur || null; hist = d.hist || []; }
    } catch (e) { /* без чернетки */ }
  }
  function save() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ A: A, cur: current, hist: hist })); } catch (e) { /* ignore */ } }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }

  function visible() { return SCREENS.filter(function (s) { return !s.when || s.when(A); }); }
  function byId(id) { return SCREENS.filter(function (s) { return s.id === id; })[0]; }

  // ---------- DOM-хелпер ----------
  function el(tag, attrs) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null || kid === false) continue;
      (Array.isArray(kid) ? kid : [kid]).forEach(function (c) { if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); });
    }
    return n;
  }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) { /* ignore */ } }

  function confetti(x, y, n) {
    if (reduceMotion) return;
    var box = el("div", { class: "confetti" });
    box.style.left = x + "px"; box.style.top = y + "px";
    var colors = ["#e0b340", "#6aa84f", "#4aa3a2", "#d9534f", "#8e7cc3"];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = 70 + Math.random() * 150;
      var p = el("i");
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", Math.cos(a) * v + "px");
      p.style.setProperty("--dy", Math.sin(a) * v - 70 + "px");
      p.style.setProperty("--r", Math.random() * 720 - 360 + "deg");
      box.append(p);
    }
    document.body.append(box);
    setTimeout(function () { box.remove(); }, 1400);
  }
  function toast(msg) {
    var t = el("div", { class: "toast", role: "status", text: msg });
    document.body.append(t);
    setTimeout(function () { t.remove(); }, 4200);
  }

  // ---------- шапка: маршрут і прогрес ----------
  var routeEl = document.getElementById("route");
  var progressWrap = document.getElementById("progressWrap");
  var progressFill = document.getElementById("progressFill");
  var progressBar = document.getElementById("progressBar");
  var progressStage = document.getElementById("progressStage");
  var progressPct = document.getElementById("progressPct");
  var nodes = [], links = [];
  STAGES.forEach(function (s, i) {
    if (i) { var l = el("div", { class: "route__link" }, el("i")); links.push(l); routeEl.append(l); }
    var n = el("div", { class: "route__node", text: String(i + 1) });
    nodes.push(n); routeEl.append(n);
  });

  function paintHeader(screen, finished) {
    var show = !!screen || finished;
    routeEl.hidden = !show; progressWrap.hidden = !show;
    if (!show) return;
    var st = finished ? STAGES.length : screen.st;
    nodes.forEach(function (n, i) {
      n.classList.toggle("is-done", i < st);
      n.classList.toggle("is-now", i === st);
      n.textContent = i < st ? "✓" : String(i + 1);
    });
    links.forEach(function (l, i) { l.classList.toggle("is-done", i < st); });
    var vis = visible();
    var idx = finished ? vis.length : vis.indexOf(screen);
    var pct = Math.round((Math.max(0, idx) / vis.length) * 100);
    progressFill.style.width = pct + "%";
    progressBar.setAttribute("aria-valuenow", String(pct));
    progressPct.textContent = pct + "%";
    progressStage.textContent = finished ? "Готово!" : "Етап " + (st + 1) + " з " + STAGES.length + " · " + STAGES[st][1];
  }

  // ---------- рендер екранів ----------
  var stageEl = document.getElementById("stage");

  function swap(card, dir) {
    var old = stageEl.querySelector(".card:not(.out-l):not(.out-r)");
    card.classList.add(dir === "back" ? "in-l" : "in-r");
    if (old) {
      old.classList.add(dir === "back" ? "out-r" : "out-l");
      setTimeout(function () { old.remove(); }, 280);
    }
    stageEl.append(card);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  var DRONE = '<svg class="drone" viewBox="0 0 200 120" aria-hidden="true">' +
    '<g stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M70 58 L32 34 M130 58 L168 34 M70 62 L32 86 M130 62 L168 86"/></g>' +
    '<rect x="72" y="46" width="56" height="26" rx="13" fill="currentColor"/><circle cx="100" cy="59" r="7" fill="var(--surface)"/>' +
    '<g fill="currentColor" opacity=".55"><ellipse class="rotor" cx="30" cy="32" rx="22" ry="5"/><ellipse class="rotor" cx="170" cy="32" rx="22" ry="5"/>' +
    '<ellipse class="rotor" cx="30" cy="88" rx="22" ry="5"/><ellipse class="rotor" cx="170" cy="88" rx="22" ry="5"/></g></svg>';

  function showIntro(dir) {
    current = null; paintHeader(null, false); lastStage = -1;
    var resume = Object.keys(A).length > 0 && !!current0 && !!byId(current0);
    var card = el("section", { class: "card hero" },
      el("div", { html: DRONE }),
      el("h1", { class: "q", text: "Анкета майбутнього пілота БпЛА" }),
      el("p", { class: "lead", text: "Це не іспит, а невеликий квест із кількох простих кроків. Відповідайте чесно: так ми підберемо навчання саме для вас." }),
      el("ul", { class: "facts" }, el("li", { text: "⏱ ≈ 7 хвилин" }), el("li", { text: "🧭 7 етапів" }), el("li", { text: "🔒 без реєстрації" })),
      resume
        ? el("div", { class: "resume" },
            el("button", { class: "btn pri big", type: "button", onclick: function () { go(current0 || "name", "fwd"); } }, "Продовжити з місця зупинки ", el("span", { class: "arr", text: "→" })),
            el("button", { class: "btn ghost", type: "button", onclick: restart, text: "Почати спочатку" }))
        : el("button", { class: "btn pri big", type: "button", onclick: function () { go("name", "fwd"); } }, "Почати квест ", el("span", { class: "arr", text: "→" })));
    swap(card, dir || "fwd");
  }
  var current0 = null;

  function restart() { A = {}; hist = []; current0 = null; clearDraft(); showIntro("back"); }

  function go(id, dir) {
    var s = byId(id);
    if (!s) return showIntro();
    var newStage = s.st !== lastStage;
    current = id; save(); paintHeader(s, false);
    swap(buildCard(s, newStage), dir);
    if (newStage && lastStage !== -1 && dir !== "back") {
      confetti(window.innerWidth / 2, window.innerHeight * 0.28, 22); buzz(14);
    }
    lastStage = s.st;
    var first = stageEl.querySelector(".card:not(.out-l):not(.out-r) .inp:not([type=date])");
    if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 380);
  }

  function buildCard(s, newStage) {
    var inputs = [];
    var card = el("section", { class: "card", "aria-label": s.title },
      el("div", { class: "badge" + (newStage ? " pop" : "") }, el("b", { text: STAGES[s.st][0] }), "Етап " + (s.st + 1) + " · " + STAGES[s.st][1]),
      s.guide ? el("p", { class: "guide", text: s.guide }) : null,
      el("h2", { class: "q" }, s.title, s.fields.some(function (f) { return f.req && f.type !== "consent"; }) && s.fields.length === 1 ? el("span", { class: "req", text: "обов’язково" }) : null),
      s.hint ? el("p", { class: "hint", text: s.hint }) : null);
    var isTextScreen = true;
    s.fields.forEach(function (f) {
      var node = buildField(s, f, inputs);
      if (f.type === "choice" || f.type === "yesno" || f.type === "scale" || f.type === "multi" || f.type === "consent") isTextScreen = false;
      card.append(node);
    });
    var answered = s.fields.every(function (f) { return A[f.name] != null; });
    var needsNext = isTextScreen || s.fields.some(function (f) { return f.type === "multi" || f.type === "consent"; }) || !s.auto || answered;
    var nav = el("div", { class: "nav" },
      el("button", { class: "btn ghost", type: "button", onclick: back, text: "← Назад" }),
      needsNext
        ? el("button", { class: "btn pri grow", type: "button", id: "nextBtn", onclick: next },
            s.final ? "Відправити анкету" : "Далі ", s.final ? null : el("span", { class: "arr", text: "→" }))
        : null);
    card.append(nav);
    if (s.optional && !s.final) {
      card.append(el("button", { class: "skip", type: "button", onclick: function () { next(true); }, text: "Пропустити" }));
    }
    return card;
  }

  function setVal(name, v) { A[name] = v; save(); }

  function buildField(s, f, inputs) {
    var wrap = el("div", { class: "fwrap" });
    var msg = el("p", { class: "msg", role: "alert", hidden: true });
    f._msg = msg;

    if (f.type === "text" || f.type === "tel" || f.type === "email" || f.type === "date" || f.type === "textarea") {
      var input = f.type === "textarea"
        ? el("textarea", { class: "inp", rows: "4", maxlength: f.max || 500 })
        : el("input", { class: "inp", type: f.type, maxlength: f.max || 200, autocomplete: f.ac || "off", inputmode: f.type === "tel" ? "tel" : null });
      if (f.ph) input.placeholder = f.ph;
      input.value = A[f.name] == null ? "" : A[f.name];
      input.addEventListener("input", function () { setVal(f.name, input.value); input.classList.remove("err"); msg.hidden = true; });
      if (f.type !== "textarea") input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); next(); } });
      f._input = input; inputs.push(input);
      wrap.append(el("label", { class: "fld" },
        f.label ? el("span", { class: "fld__l" }, f.label, f.req && s.fields.length > 1 ? el("span", { class: "req", text: "обов’язково" }) : null) : null, input), msg);
      return wrap;
    }

    var group;
    if (f.type === "consent") {
      var btn = el("button", { class: "consent" + (A.consent ? " on" : ""), type: "button", role: "checkbox", "aria-checked": A.consent ? "true" : "false" },
        el("span", { class: "box", text: "✓" }),
        el("span", { text: "Я погоджуюсь на обробку персональних даних із цієї анкети для проведення відбору кандидатів." }));
      btn.addEventListener("click", function () {
        var on = !A.consent; setVal("consent", on); buzz();
        btn.classList.toggle("on", on); btn.classList.remove("err"); btn.setAttribute("aria-checked", on ? "true" : "false"); msg.hidden = true;
      });
      f._input = btn;
      wrap.append(btn, msg);
      return wrap;
    }

    if (f.type === "multi") {
      group = el("div", { class: "chips", role: "group" });
      var sel = Array.isArray(A[f.name]) ? A[f.name] : [];
      f.options.forEach(function (o) {
        var b = el("button", { class: "opt" + (sel.indexOf(o[0]) >= 0 ? " on" : ""), type: "button", "aria-pressed": sel.indexOf(o[0]) >= 0 ? "true" : "false" },
          el("span", { class: "em", text: o[1] }), el("span", { text: o[2] }));
        b.addEventListener("click", function () {
          var cur = Array.isArray(A[f.name]) ? A[f.name].slice() : [];
          var i = cur.indexOf(o[0]);
          if (i >= 0) cur.splice(i, 1); else cur.push(o[0]);
          setVal(f.name, cur); buzz();
          b.classList.toggle("on", i < 0); b.setAttribute("aria-pressed", i < 0 ? "true" : "false");
        });
        group.append(b);
      });
      wrap.append(group);
      return wrap;
    }

    // choice | yesno | scale: один вибір
    var opts = f.type === "yesno" ? [[true, "👍", "Так"], [false, "🙅", "Ні"]] : f.options;
    group = el("div", { class: "opts" + (f.type === "yesno" ? " row2" : ""), role: "radiogroup" });
    var buttons = [];
    opts.forEach(function (o, idx) {
      var on = A[f.name] === o[0] || (f.type === "scale" && A[f.name] != null && Number(A[f.name]) === o[0]);
      var content;
      if (f.type === "scale") {
        var meter = el("span", { class: "meter" });
        var total = f.options.length;
        for (var k = 0; k < total; k++) meter.append(el("i", { class: k <= idx ? "lit" : "", style: "height:" + (10 + k * (14 / Math.max(1, total - 1))) + "px" }));
        content = [el("span", { text: o[1] }), meter];
      } else {
        content = [el("span", { class: "em", text: o[1] }), el("span", null, o[2], o[3] ? el("small", { text: o[3] }) : null)];
      }
      var b = el("button", { class: "opt" + (f.type === "scale" ? " has-meter" : "") + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false" }, content);
      b.addEventListener("click", function () {
        setVal(f.name, o[0]); buzz();
        buttons.forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); });
        b.classList.add("on"); b.setAttribute("aria-checked", "true");
        group.classList.remove("err"); msg.hidden = true;
        if (s.auto && s.fields.length === 1) setTimeout(function () { if (current === s.id) next(); }, 420);
      });
      buttons.push(b); group.append(b);
    });
    f._input = group;
    wrap.append(group, msg);
    return wrap;
  }

  // ---------- навігація ----------
  function validate(s, skipping) {
    var ok = true;
    s.fields.forEach(function (f) {
      var v = A[f.name], empty = v == null || v === "" || (Array.isArray(v) && !v.length);
      var message = null;
      if (f.req && (f.type === "consent" ? v !== true : empty)) message = f.type === "consent" ? "Щоб відправити анкету, потрібна ваша згода" : "Це поле обов’язкове";
      else if (!skipping && f.check && !empty && !f.check(v)) message = f.err;
      else if (skipping && f.req) message = "Це поле обов’язкове";
      if (message) {
        ok = false;
        if (f._msg) { f._msg.textContent = message; f._msg.hidden = false; }
        if (f._input) { f._input.classList.remove("err"); void f._input.offsetWidth; f._input.classList.add("err"); }
      }
    });
    if (!ok) buzz(30);
    return ok;
  }

  function next(skipping) {
    if (busy) return;
    var s = byId(current);
    if (!s) return;
    if (skipping === true) {
      // «Пропустити» очищає відповіді екрана, але не пропускає обов'язкові поля
      s.fields.forEach(function (f) { if (!f.req) delete A[f.name]; });
    }
    if (!validate(s, skipping === true)) return;
    if (s.final) return submit();
    var vis = visible();
    var i = vis.indexOf(s);
    var nx = vis[i + 1];
    if (!nx) return submit();
    hist.push(s.id); save();
    go(nx.id, "fwd");
  }

  function back() {
    if (busy) return;
    var prev = hist.pop();
    if (!prev) { current0 = current; return showIntro("back"); }
    go(prev, "back");
  }

  // ---------- відправлення ----------
  var supabaseClient = null;
  try {
    if (window.supabase && window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.url.indexOf("YOUR-PROJECT") < 0) {
      // Анкета завжди працює як анонімний кандидат: сесію штабу з localStorage цього ж домену не підхоплюємо.
      supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "sb-survey-anon" },
      });
    }
  } catch (e) { console.error("Supabase init failed", e); }

  function buildPayload() {
    var names = {};
    visible().forEach(function (s) { s.fields.forEach(function (f) { names[f.name] = true; }); });
    var val = function (n) {
      var v = names[n] ? A[n] : null;
      if (typeof v === "string") v = v.trim();
      return v == null || v === "" ? null : v;
    };
    var flag = function (n) { return !!names[n] && A[n] === true; };
    var arr = function (n) { return names[n] && Array.isArray(A[n]) ? A[n] : []; };
    var num = function (n) { var v = val(n); return v == null ? 0 : Number(v) || 0; };
    return {
      residence_type: val("residence_type"), full_name: val("full_name"), birth_date: val("birth_date"),
      phone: val("phone"), email: val("email"), region: val("region"),
      status: val("status"), unit: val("unit"), approx_service_years: val("approx_service_years"),
      position_specialty: val("position_specialty"), profile_courses: val("profile_courses"),
      equipment_experience: val("equipment_experience"), trained_others: flag("trained_others"),
      trained_others_details: val("trained_others_details"), awards: val("awards"),
      education_level: val("education_level"), education_field: val("education_field"),
      uav_experience: flag("uav_experience"), uav_types: arr("uav_types"), uav_hours: val("uav_hours"),
      rc_experience: flag("rc_experience"), rc_details: val("rc_details"),
      sim_experience: flag("sim_experience"), sim_details: val("sim_details"),
      skill_electronics: num("skill_electronics"), skill_programming: num("skill_programming"), skill_repair: num("skill_repair"),
      driver_license: arr("driver_license"),
      vision: val("vision"), health_limitations: val("health_limitations"), stress_resilience: num("stress_resilience"),
      hobbies: val("hobbies"), info_perception: val("info_perception"), character_traits: val("character_traits"), talk_topics: val("talk_topics"),
      motivation: val("motivation"), contact_person: val("contact_person"), additional_info: val("additional_info"),
      consent: A.consent === true,
    };
  }

  async function submit() {
    var btn = document.getElementById("nextBtn");
    busy = true;
    if (btn) { btn.disabled = true; btn.textContent = "Відправляємо…"; }
    try {
      if (!DRY_RUN) {
        if (!supabaseClient) throw new Error("no-config");
        var res = await supabaseClient.from("candidates").insert(buildPayload());
        if (res.error) throw res.error;
      }
      clearDraft(); A = {}; hist = [];
      showDone();
    } catch (err) {
      console.error(err);
      toast(err && err.message === "no-config" ? "Форму ще не підключено до бази даних." : "Не вдалося відправити. Перевірте з'єднання й спробуйте ще раз.");
      if (btn) { btn.disabled = false; btn.textContent = "Відправити анкету"; }
    } finally { busy = false; }
  }

  function showDone() {
    current = null; paintHeader(null, true);
    var card = el("section", { class: "card done" },
      el("div", { class: "seal", html: '<svg viewBox="0 0 52 52"><path d="M12 27l10 10 18-21"/></svg>' }),
      el("h1", { class: "q", text: "Місію виконано!" }),
      el("p", { class: "lead", text: "Дякуємо! Анкету відправлено, ви пройшли всі етапи. З вами зв’яжуться за вказаним номером телефону." }));
    swap(card, "fwd");
    setTimeout(function () { confetti(window.innerWidth / 2, window.innerHeight * 0.35, 46); }, 250);
    buzz(40);
  }

  // ---------- старт ----------
  load();
  if (current && byId(current)) { current0 = current; }
  showIntro();
})();
