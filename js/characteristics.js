// Формує коротку характеристику кандидата на основі відповідей анкети.
// Правило-базований скоринг (без зовнішніх AI-сервісів): кожен блок дає
// бали й тег, сума балів перетворюється на загальний рейтинг і висновок.

// Витягує перше ціле число зі строкового поля "приблизний строк служби".
window.parseServiceYears = function (text) {
  if (!text) return null;
  var m = String(text).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};

window.buildCharacteristic = function (c) {
  var tags = [];
  var score = 0;

  // Досвід з БпЛА/авіацією
  if (c.uav_experience) {
    score += 25;
    var types = (c.uav_types || []).length;
    tags.push(types > 1 ? "Досвідчений БпЛА-оператор" : "Має досвід з БпЛА");
  } else if (c.sim_experience || c.rc_experience) {
    score += 10;
    tags.push("Суміжний досвід (симулятор/RC)");
  } else {
    tags.push("Без профільного досвіду");
  }

  // Технічні навички
  var techAvg = ((c.skill_electronics || 0) + (c.skill_programming || 0) + (c.skill_repair || 0)) / 3;
  score += techAvg * 10;
  if (techAvg >= 2) tags.push("Високий технічний рівень");
  else if (techAvg >= 1) tags.push("Середній технічний рівень");
  else tags.push("Технічні навички потребують розвитку");

  // Стресостійкість
  var stress = c.stress_resilience || 0;
  score += stress * 5;
  if (stress >= 4) tags.push("Висока стресостійкість");
  else if (stress > 0 && stress <= 2) tags.push("Потребує уваги: стресостійкість");

  // Зір / здоров'я
  if (c.vision === "impaired") tags.push("Обмеження зору");
  if (c.health_limitations && c.health_limitations.trim()) tags.push("Є зауваження щодо здоров'я");

  // Строк служби
  var years = window.parseServiceYears(c.approx_service_years);
  if (years !== null && years > 5) {
    score += 10;
    tags.push("Досвідчений військовослужбовець (" + years + "+ р.)");
    if (c.trained_others) tags.push("Має досвід навчання інших");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  var level = score >= 70 ? "Високий потенціал" : score >= 40 ? "Середній потенціал" : "Потребує додаткової оцінки";

  return { score: score, level: level, tags: tags };
};

/**
 * Короткий текстовий підсумок для інструктора: характеристика, особливості,
 * теми для спілкування. Використовується і на сторінці штабу, і в docx-досьє
 * (дзеркальна логіка в Ocinka: data/CandidatesModels.kt → buildSummary).
 */
window.buildSummary = function (c) {
  var ch = window.buildCharacteristic(c);
  var parts = [];

  parts.push("Загальний рейтинг: " + ch.score + "/100 (" + ch.level + ").");

  if (c.uav_experience) {
    parts.push("Має практичний досвід керування БпЛА" + ((c.uav_types || []).length ? " (" + c.uav_types.join(", ") + ")" : "") + (c.uav_hours ? ", наліт: " + c.uav_hours : "") + ".");
  } else if (c.sim_experience || c.rc_experience) {
    parts.push("Прямого досвіду з БпЛА немає, але є суміжний досвід через симулятори та/або RC-моделі.");
  } else {
    parts.push("Профільного досвіду з БпЛА чи суміжних напрямів не має — потрібна підготовка з нуля.");
  }

  var techAvg = ((c.skill_electronics || 0) + (c.skill_programming || 0) + (c.skill_repair || 0)) / 3;
  if (techAvg >= 2) parts.push("Технічна база (електроніка/програмування/ремонт) сильна — можна довіряти складніші технічні завдання.");
  else if (techAvg >= 1) parts.push("Технічна база середня — потрібне додаткове навчання за окремими напрямами.");
  else parts.push("Технічна база слабка — варто починати з базових понять.");

  var stress = c.stress_resilience || 0;
  if (stress >= 4) parts.push("Самооцінка стресостійкості висока.");
  else if (stress > 0 && stress <= 2) parts.push("Самооцінка стресостійкості низька — варто звернути увагу під час практичних занять під тиском часу.");

  if (c.health_limitations && c.health_limitations.trim()) {
    parts.push("Є зауваження щодо стану здоров'я: " + c.health_limitations.trim() + ".");
  }

  var years = window.parseServiceYears(c.approx_service_years);
  if (years !== null && years > 5) {
    var svc = "Строк служби приблизно " + years + " років";
    var details = [];
    if (c.position_specialty) details.push("посада/спеціальність: " + c.position_specialty);
    if (c.equipment_experience) details.push("досвід з технікою: " + c.equipment_experience);
    if (c.profile_courses) details.push("профільні курси: " + c.profile_courses);
    svc += details.length ? " (" + details.join("; ") + ")" : "";
    svc += ".";
    parts.push(svc);
    if (c.trained_others) {
      parts.push("Має досвід навчання/інструктажу інших" + (c.trained_others_details ? ": " + c.trained_others_details : "") + " — варто розглянути як потенційного помічника інструктора.");
    }
  }

  var personal = [];
  if (c.character_traits) personal.push("риси характеру: " + c.character_traits);
  if (c.hobbies) personal.push("захоплення: " + c.hobbies);
  var perceptionLabels = { practice: "краще сприймає інформацію через практику", theory: "краще сприймає інформацію через теорію", observation: "краще сприймає інформацію через спостереження", mixed: "однаково добре сприймає інформацію різними способами" };
  if (c.info_perception && perceptionLabels[c.info_perception]) personal.push(perceptionLabels[c.info_perception]);
  if (personal.length) parts.push("Особисті особливості: " + personal.join("; ") + ".");

  if (c.talk_topics) {
    parts.push("Теми для особистої розмови з курсантом: " + c.talk_topics + ".");
  } else if (c.hobbies) {
    parts.push("Теми для особистої розмови з курсантом: можна відштовхнутись від захоплень (" + c.hobbies + ").");
  }

  if (c.motivation) parts.push("Мотивація у власних словах: «" + c.motivation + "».");

  return parts.join(" ");
};
