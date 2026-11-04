// Експорт анкет у .docx у вигляді досьє: одна анкета = одна сторінка (або дві) формату A4.
// Використовує бібліотеку docx (глобальний `docx`) і window.buildCharacteristic / buildSummary.
(function () {
  "use strict";

  var OLIVE = "3F5E2B", SOFT = "EEF2E8", LINE = "C9D3BC", INK = "1F2A17", MUTED = "5C6B50";
  var CONTENT_W = 9638; // ширина тексту A4 при полях 2 см, twips

  var STATUS = { civilian: "Цивільна особа", military: "Військовослужбовець" };
  var EDU = { secondary: "Повна загальна середня", vocational: "Професійно-технічна", bachelor: "Бакалавр", master: "Магістр / спеціаліст", other: "Інше" };
  var UAV = { fpv: "FPV-дрон", multirotor: "Мультикоптер", fixed_wing: "Літак (крило)", vtol: "VTOL" };
  var VISION = { normal: "Нормальний, без корекції", corrected: "З корекцією (окуляри/лінзи)", impaired: "Є суттєві обмеження" };
  var PERCEPTION = { practice: "Через практику", theory: "Через теорію / пояснення", observation: "Через спостереження за іншими", mixed: "Однаково добре по-різному" };
  var SKILL_WORD = ["Немає навичок", "Базовий рівень", "Середній рівень", "Високий рівень"];

  function d() { return window.docx; }
  function dash(v) { return v == null || String(v).trim() === "" ? "—" : String(v).trim(); }
  function fmtDate(iso) {
    if (!iso) return "—";
    var x = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00:00" : iso);
    return isNaN(x) ? String(iso) : x.toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" });
  }
  function fmtDateTime(iso) {
    var x = new Date(iso);
    return fmtDate(iso) + ", " + x.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  }
  function dots(n, total) { var s = ""; for (var i = 0; i < total; i++) s += i < n ? "●" : "○"; return s; }

  function run(text, o) { return new (d().TextRun)(Object.assign({ text: text }, o || {})); }
  function para(children, o) {
    return new (d().Paragraph)(Object.assign({ children: Array.isArray(children) ? children : [children] }, o || {}));
  }
  function noBorder() { var n = { style: d().BorderStyle.NONE, size: 0, color: "FFFFFF" }; return { top: n, bottom: n, left: n, right: n }; }
  function thin(color) { return { style: d().BorderStyle.SINGLE, size: 4, color: color || LINE }; }
  function allThin() { var b = thin(); return { top: b, bottom: b, left: b, right: b }; }
  var MARGINS = { top: 70, bottom: 70, left: 120, right: 120 };

  // Заголовок розділу з оливковою лінією
  function heading(text, num) {
    return para([run(num + "  ", { bold: true, color: OLIVE, size: 24 }), run(text.toUpperCase(), { bold: true, color: OLIVE, size: 22, characterSpacing: 20 })], {
      spacing: { before: 260, after: 90 }, keepNext: true,
      border: { bottom: { style: d().BorderStyle.SINGLE, size: 8, color: OLIVE, space: 2 } },
    });
  }

  // Таблиця «ключ — значення»; value може бути рядком або масивом рядків (абзаців)
  function kvTable(rows) {
    var D = d();
    return new D.Table({
      width: { size: CONTENT_W, type: D.WidthType.DXA }, columnWidths: [3000, CONTENT_W - 3000],
      borders: Object.assign({ insideHorizontal: thin(), insideVertical: thin() }, allThin()),
      rows: rows.map(function (r) {
        var lines = Array.isArray(r[1]) ? r[1] : [r[1]];
        return new D.TableRow({
          cantSplit: true,
          children: [
            new D.TableCell({
              width: { size: 3000, type: D.WidthType.DXA }, margins: MARGINS, shading: { type: D.ShadingType.CLEAR, fill: SOFT, color: "auto" },
              verticalAlign: D.VerticalAlign.CENTER,
              children: [para(run(r[0], { bold: true, color: INK, size: 20 }))],
            }),
            new D.TableCell({
              width: { size: CONTENT_W - 3000, type: D.WidthType.DXA }, margins: MARGINS, verticalAlign: D.VerticalAlign.CENTER,
              children: lines.map(function (t) { return para(run(t, { size: 21, color: INK })); }),
            }),
          ],
        });
      }),
    });
  }

  function section(num, title, rows) { return [heading(title, num), kvTable(rows)]; }

  // Блок з іменем і рейтингом
  function banner(r, ch) {
    var D = d();
    var statusText = STATUS[r.status] ? STATUS[r.status] + (r.status === "military" && r.unit ? " (" + r.unit + ")" : "") : "статус не вказано";
    var scoreCell = new D.TableCell({
      width: { size: 2100, type: D.WidthType.DXA }, margins: { top: 140, bottom: 140, left: 120, right: 120 },
      shading: { type: D.ShadingType.CLEAR, fill: OLIVE, color: "auto" }, verticalAlign: D.VerticalAlign.CENTER,
      borders: allThin(),
      children: [
        para(run(String(ch.score), { bold: true, size: 72, color: "FFFFFF" }), { alignment: D.AlignmentType.CENTER, spacing: { after: 0 } }),
        para(run("з 100 балів", { size: 18, color: "DCE7D2" }), { alignment: D.AlignmentType.CENTER }),
      ],
    });
    var tagLines = ch.tags.length ? ch.tags : ["—"];
    var infoCell = new D.TableCell({
      width: { size: CONTENT_W - 2100, type: D.WidthType.DXA }, margins: { top: 120, bottom: 120, left: 200, right: 160 },
      shading: { type: D.ShadingType.CLEAR, fill: SOFT, color: "auto" }, verticalAlign: D.VerticalAlign.CENTER, borders: allThin(),
      children: [para(run(ch.level, { bold: true, size: 26, color: OLIVE }), { spacing: { after: 60 } })].concat(
        tagLines.map(function (t) { return para([run("▪ ", { color: OLIVE, size: 20 }), run(t, { size: 20, color: INK })], { spacing: { after: 20 } }); })),
    });
    return [
      para([run("ДОСЬЄ КАНДИДАТА", { bold: true, size: 20, color: OLIVE, characterSpacing: 60 }), run("   пілот БпЛА", { size: 20, color: MUTED })], {
        spacing: { after: 60 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: OLIVE, space: 4 } },
      }),
      para(run((r.full_name || "").trim() || "Без імені", { bold: true, size: 44, color: INK }), { spacing: { before: 120, after: 40 }, keepNext: true }),
      para(run("Анкету подано: " + fmtDateTime(r.created_at) + "   ·   " + statusText, { size: 20, color: MUTED }), { spacing: { after: 160 } }),
      new D.Table({
        width: { size: CONTENT_W, type: D.WidthType.DXA }, columnWidths: [2100, CONTENT_W - 2100], borders: allThin(),
        rows: [new D.TableRow({ cantSplit: true, children: [scoreCell, infoCell] })],
      }),
    ];
  }

  function motivationBlock(r) {
    var D = d();
    var line = { style: D.BorderStyle.SINGLE, size: 24, color: OLIVE, space: 8 };
    var text = dash(r.motivation);
    return [para(run(text === "—" ? "—" : "«" + text + "»", { italics: true, size: 22, color: INK }), {
      spacing: { before: 80, after: 100, line: 300 }, indent: { left: 200 }, border: { left: line },
    })];
  }

  function summaryBox(r) {
    var D = d();
    return new D.Table({
      width: { size: CONTENT_W, type: D.WidthType.DXA }, columnWidths: [CONTENT_W], borders: allThin(),
      rows: [new D.TableRow({ cantSplit: false, children: [new D.TableCell({
        width: { size: CONTENT_W, type: D.WidthType.DXA }, margins: { top: 140, bottom: 140, left: 200, right: 200 },
        shading: { type: D.ShadingType.CLEAR, fill: SOFT, color: "auto" },
        children: [para(run(window.buildSummary(r), { size: 21, color: INK }), { spacing: { line: 300 } })],
      })] })],
    });
  }

  // Усі блоки одного досьє (без розриву сторінки перед ним)
  function dossierBlocks(r) {
    var ch = window.buildCharacteristic(r);
    var out = banner(r, ch);

    out = out.concat(section("1", "Контакти та проживання", [
      ["Адреса на час зборів", dash(r.residence_type)],
      ["Телефон", dash(r.phone)],
      ["Email", dash(r.email)],
      ["Дата народження", fmtDate(r.birth_date)],
      ["Область / населений пункт", dash(r.region)],
    ]));

    var service = [["Статус", STATUS[r.status] || "—"]];
    if (r.status === "military") service.push(["Підрозділ", dash(r.unit)], ["Строк служби", dash(r.approx_service_years)]);
    if (r.position_specialty || r.profile_courses || r.equipment_experience || r.trained_others || r.awards) {
      service.push(["Посада / спеціальність", dash(r.position_specialty)], ["Профільні курси", dash(r.profile_courses)],
        ["Досвід з технікою", dash(r.equipment_experience)],
        ["Навчав(ла) інших", r.trained_others ? (r.trained_others_details ? "Так: " + r.trained_others_details : "Так") : "Ні"],
        ["Нагороди / відзнаки", dash(r.awards)]);
    }
    service.push(["Освіта", EDU[r.education_level] || dash(r.education_level)], ["Спеціальність / напрям", dash(r.education_field)]);
    out = out.concat(section("2", "Служба та освіта", service));

    var types = (r.uav_types || []).map(function (t) { return UAV[t] || t; });
    out = out.concat(section("3", "Досвід з БпЛА та авіацією", [
      ["Керування БпЛА", r.uav_experience ? "Так" : "Ні"],
      ["Типи апаратів", r.uav_experience ? (types.join(", ") || "—") : "—"],
      ["Наліт", r.uav_experience ? dash(r.uav_hours) : "—"],
      ["RC-моделі / авіамодельний спорт", r.rc_experience ? (r.rc_details ? "Так: " + r.rc_details : "Так") : "Ні"],
      ["Авіасимулятори", r.sim_experience ? (r.sim_details ? "Так: " + r.sim_details : "Так") : "Ні"],
    ]));

    function skill(n) { n = Math.max(0, Math.min(3, Number(n) || 0)); return dots(n, 3) + "   " + SKILL_WORD[n]; }
    out = out.concat(section("4", "Технічні навички", [
      ["Електроніка / радіотехніка", skill(r.skill_electronics)],
      ["Програмування / налаштування", skill(r.skill_programming)],
      ["Ремонт / обслуговування техніки", skill(r.skill_repair)],
      ["Водійські категорії", (r.driver_license || []).join(", ") || "—"],
    ]));

    var stress = Math.max(0, Math.min(5, Number(r.stress_resilience) || 0));
    out = out.concat(section("5", "Фізичний і психологічний стан", [
      ["Зір", VISION[r.vision] || dash(r.vision)],
      ["Обмеження за станом здоров’я", dash(r.health_limitations)],
      ["Самооцінка стресостійкості", stress ? dots(stress, 5) + "   " + stress + " з 5" : "—"],
    ]));

    out = out.concat(section("6", "Особисті якості та інтереси", [
      ["Хобі / захоплення", dash(r.hobbies)],
      ["Сприйняття інформації", PERCEPTION[r.info_perception] || dash(r.info_perception)],
      ["Риси характеру", dash(r.character_traits)],
      ["Теми для розмови", dash(r.talk_topics)],
    ]));

    out.push(heading("Мотивація", "7"));
    out = out.concat(motivationBlock(r));
    out.push(kvTable([["Контактна особа командування", dash(r.contact_person)], ["Додаткова інформація", dash(r.additional_info)]]));

    out.push(heading("Підсумок для інструктора", "8"));
    out.push(summaryBox(r));
    return out;
  }

  function overview(items, title) {
    var D = d();
    var head = ["№", "ПІБ", "Бал", "Телефон", "Статус", "БпЛА", "Область"];
    var widths = [520, 2750, 700, 2050, 1400, 700, 1518];
    function cell(text, i, header, shade) {
      return new D.TableCell({
        width: { size: widths[i], type: D.WidthType.DXA }, margins: MARGINS, verticalAlign: D.VerticalAlign.CENTER,
        shading: header ? { type: D.ShadingType.CLEAR, fill: OLIVE, color: "auto" } : shade ? { type: D.ShadingType.CLEAR, fill: SOFT, color: "auto" } : undefined,
        children: [para(run(String(text), { size: 19, bold: !!header || i === 1, color: header ? "FFFFFF" : INK }), { alignment: i === 0 || i === 2 || i === 5 ? D.AlignmentType.CENTER : D.AlignmentType.LEFT })],
      });
    }
    var rows = [new D.TableRow({ tableHeader: true, cantSplit: true, children: head.map(function (t, i) { return cell(t, i, true); }) })];
    items.forEach(function (r, n) {
      var ch = window.buildCharacteristic(r);
      var vals = [n + 1, dash(r.full_name), ch.score, dash(r.phone), r.status === "military" ? "Військовий" : "Цивільний", r.uav_experience ? "так" : "ні", dash(r.region)];
      rows.push(new D.TableRow({ cantSplit: true, children: vals.map(function (v, i) { return cell(v, i, false, n % 2 === 1); }) }));
    });
    var high = items.filter(function (r) { return window.buildCharacteristic(r).score >= 70; }).length;
    var uav = items.filter(function (r) { return r.uav_experience; }).length;
    return [
      para([run("ЗВЕДЕННЯ ЗА ДАТОЮ", { bold: true, size: 20, color: OLIVE, characterSpacing: 60 })], {
        spacing: { after: 60 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: OLIVE, space: 4 } },
      }),
      para(run(title, { bold: true, size: 40, color: INK }), { spacing: { before: 120, after: 40 } }),
      para(run("Анкет: " + items.length + "   ·   високий потенціал: " + high + "   ·   з досвідом БпЛА: " + uav, { size: 21, color: MUTED }), { spacing: { after: 200 } }),
      new D.Table({ width: { size: CONTENT_W, type: D.WidthType.DXA }, columnWidths: widths, borders: Object.assign({ insideHorizontal: thin(), insideVertical: thin() }, allThin()), rows: rows }),
      para(run("Далі: досьє кандидатів у порядку подання анкет.", { size: 19, italics: true, color: MUTED }), { spacing: { before: 160 } }),
    ];
  }

  function buildDoc(items, opts) {
    var D = d();
    var stamp = "Сформовано " + new Date().toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    var children = [];
    if (opts && opts.title) children = children.concat(overview(items, opts.title));
    items.forEach(function (r, i) {
      var blocks = dossierBlocks(r);
      if (i > 0 || (opts && opts.title)) {
        // розрив сторінки перед кожним досьє
        blocks.unshift(new D.Paragraph({ children: [new D.PageBreak()], spacing: { after: 0 } }));
      }
      children = children.concat(blocks);
    });
    return new D.Document({
      creator: "Штаб відбору", title: opts && opts.title ? opts.title : "Досьє кандидата",
      styles: { default: { document: { run: { font: "Calibri", size: 21, color: INK }, paragraph: { spacing: { after: 60 } } } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 500, footer: 500 } } },
        headers: { default: new D.Header({ children: [para([run("ШТАБ ВІДБОРУ  ·  КАНДИДАТИ В ПІЛОТИ БпЛА", { size: 16, color: MUTED, characterSpacing: 30 })], { alignment: D.AlignmentType.RIGHT })] }) },
        footers: { default: new D.Footer({ children: [para([
          run("Конфіденційно: містить персональні дані  ·  " + stamp + "  ·  Сторінка ", { size: 16, color: MUTED }),
          new D.TextRun({ children: [D.PageNumber.CURRENT], size: 16, color: MUTED }), run(" з ", { size: 16, color: MUTED }),
          new D.TextRun({ children: [D.PageNumber.TOTAL_PAGES], size: 16, color: MUTED }),
        ], { alignment: D.AlignmentType.CENTER, border: { top: { style: D.BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } } })] }) },
        children: children,
      }],
    });
  }

  function safeName(s) { return String(s || "").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").slice(0, 80) || "kandydat"; }

  /** Повертає Promise<Blob> з досьє для списку анкет (з необов'язковим титулом зведення). */
  function toBlob(items, opts) { return d().Packer.toBlob(buildDoc(items, opts)); }

  window.Dossier = { toBlob: toBlob, buildDoc: buildDoc, safeName: safeName };
})();
