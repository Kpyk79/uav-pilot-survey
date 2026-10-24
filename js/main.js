(function () {
  "use strict";

  // ---------- clock ----------
  var clockEl = document.getElementById("clock");
  function tick() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    clockEl.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  tick();
  setInterval(tick, 1000);

  // ---------- panel switching (intro -> form -> done) ----------
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));
  function showPanel(name) {
    panels.forEach(function (p) { p.classList.toggle("is-active", p.dataset.panel === name); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.getElementById("startBtn").addEventListener("click", function () { showPanel("form"); });

  // ---------- wizard steps ----------
  var form = document.getElementById("surveyForm");
  var steps = Array.prototype.slice.call(form.querySelectorAll(".step"));
  var current = 0;

  var progressFill = document.getElementById("progressFill");
  var progressSteps = document.getElementById("progressSteps");
  steps.forEach(function (s, i) {
    var span = document.createElement("span");
    span.textContent = (i + 1) + ". " + s.dataset.title;
    progressSteps.appendChild(span);
  });

  function renderProgress() {
    progressFill.style.width = ((current) / (steps.length - 1)) * 100 + "%";
    Array.prototype.forEach.call(progressSteps.children, function (el, i) {
      el.classList.toggle("is-current", i === current);
    });
  }

  function renderStep() {
    steps.forEach(function (s, i) { s.classList.toggle("is-active", i === current); });
    document.getElementById("prevBtn").hidden = current === 0;
    var isLast = current === steps.length - 1;
    document.getElementById("nextBtn").hidden = isLast;
    document.getElementById("submitBtn").hidden = !isLast;
    renderProgress();
    applyConditionalFields();
  }

  function validateStep(stepEl) {
    var inputs = stepEl.querySelectorAll("[required]");
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.offsetParent === null && !el.closest("[data-show-if].is-visible")) continue; // hidden & not shown
      if (el.type === "checkbox" && !el.checked) { flagError(el); return false; }
      if (el.type !== "checkbox" && !el.value.trim()) { flagError(el); return false; }
    }
    return true;
  }
  function flagError(el) {
    el.classList.add("field-error");
    el.focus();
    setTimeout(function () { el.classList.remove("field-error"); }, 2000);
  }

  document.getElementById("nextBtn").addEventListener("click", function () {
    if (!validateStep(steps[current])) return;
    if (current < steps.length - 1) { current++; renderStep(); }
  });
  document.getElementById("prevBtn").addEventListener("click", function () {
    if (current > 0) { current--; renderStep(); }
  });

  // ---------- conditional fields (data-show-if="field=value") ----------
  function applyConditionalFields() {
    form.querySelectorAll("[data-show-if]").forEach(function (el) {
      var rule = el.dataset.showIf.split("=");
      var name = rule[0], val = rule[1];
      var field = form.querySelector('[name="' + name + '"]');
      var visible = false;
      if (field) {
        if (field.type === "checkbox") visible = field.checked && val === "on";
        else visible = field.value === val;
      }
      el.classList.toggle("is-visible", visible);
    });
  }
  form.addEventListener("change", applyConditionalFields);

  // ---------- skill scales (0-3 / 1-5 dot picker) ----------
  form.querySelectorAll(".skill").forEach(function (group) {
    var hidden = group.querySelector('input[type="hidden"]');
    var dots = Array.prototype.slice.call(group.querySelectorAll(".skill__dot"));
    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        hidden.value = dot.dataset.val;
        dots.forEach(function (d) { d.classList.toggle("is-selected", d === dot); });
      });
    });
  });

  // ---------- chip groups -> array values ----------
  function collectChips(name) {
    var group = form.querySelector('[data-chips="' + name + '"]');
    if (!group) return [];
    return Array.prototype.slice.call(group.querySelectorAll('input[type="checkbox"]:checked')).map(function (c) { return c.value; });
  }

  // ---------- supabase client ----------
  var supabaseClient = null;
  try {
    if (window.supabase && window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && !window.SUPABASE_CONFIG.url.includes("YOUR-PROJECT")) {
      supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    }
  } catch (e) { console.error("Supabase init failed", e); }

  function showToast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validateStep(steps[current])) return;

    var fd = new FormData(form);
    var payload = {
      residence_type: fd.get("residence_type") || null,
      residence_note: fd.get("residence_note") || null,
      full_name: fd.get("full_name") || null,
      birth_date: fd.get("birth_date") || null,
      phone: fd.get("phone") || null,
      email: fd.get("email") || null,
      region: fd.get("region") || null,

      status: fd.get("status") || null,
      unit: fd.get("unit") || null,
      education_level: fd.get("education_level") || null,
      education_field: fd.get("education_field") || null,

      uav_experience: fd.get("uav_experience") === "on",
      uav_types: collectChips("uav_types"),
      uav_hours: fd.get("uav_hours") || null,
      rc_experience: fd.get("rc_experience") === "on",
      rc_details: fd.get("rc_details") || null,
      sim_experience: fd.get("sim_experience") === "on",
      sim_details: fd.get("sim_details") || null,

      skill_electronics: Number(fd.get("skill_electronics") || 0),
      skill_programming: Number(fd.get("skill_programming") || 0),
      skill_repair: Number(fd.get("skill_repair") || 0),
      driver_license: collectChips("driver_license"),

      vision: fd.get("vision") || null,
      health_limitations: fd.get("health_limitations") || null,
      stress_resilience: Number(fd.get("stress_resilience") || 0),
      stress_example: fd.get("stress_example") || null,

      motivation: fd.get("motivation") || null,
      availability: fd.get("availability") || null,
      availability_note: fd.get("availability_note") || null,
      contact_person: fd.get("contact_person") || null,
      additional_info: fd.get("additional_info") || null,

      consent: fd.get("consent") === "on",
    };

    var submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Відправлення…";

    try {
      if (!supabaseClient) throw new Error("no-config");
      var res = await supabaseClient.from("candidates").insert(payload);
      if (res.error) throw res.error;
      showPanel("done");
    } catch (err) {
      console.error(err);
      if (err && err.message === "no-config") {
        showToast("Форму ще не підключено до бази даних. Заповніть js/config.js.");
      } else {
        showToast("Не вдалося відправити анкету. Перевірте з'єднання та спробуйте ще раз.");
      }
      submitBtn.disabled = false;
      submitBtn.textContent = "Відправити анкету";
    }
  });

  renderStep();
})();
