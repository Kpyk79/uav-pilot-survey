// Формує коротку характеристику кандидата на основі відповідей анкети.
// Правило-базований скоринг (без зовнішніх AI-сервісів): кожен блок дає
// бали й тег, сума балів перетворюється на загальний рейтинг і висновок.
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

  // Проживання
  if (c.residence_type === "needs_housing") tags.push("Потребує забезпечення житлом");

  // Готовність
  if (c.availability === "full") score += 10;
  if (c.availability === "limited") tags.push("Обмежена готовність за часом");

  score = Math.max(0, Math.min(100, Math.round(score)));

  var level = score >= 70 ? "Високий потенціал" : score >= 40 ? "Середній потенціал" : "Потребує додаткової оцінки";

  return { score: score, level: level, tags: tags };
};
