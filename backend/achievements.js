// Achievements and XP levels. Everything is derived from a student's results and answers;
// earned achievements are stored in the `achievements` table so they keep their earned date.
const { pool } = require("./db");
const { UNITS } = require("./lib");
const UNIT_COUNT = Object.keys(UNITS).length;

const TIER_XP = { bronze: 50, silver: 150, gold: 300 };
const XP_PER_CORRECT = 10;
const LEVELS = [
  [0, "مبتدئ"], [300, "متدرّب"], [1000, "مجتهد"], [2500, "متمكّن"], [5000, "متقدّم"], [9000, "خبير"], [15000, "أسطورة"],
];
const MIN_UNIT = 10; // answers needed in a unit before it counts towards an achievement

// check(s) returns [current, goal]; the achievement is earned when current >= goal.
const DEFS = [
  { code: "first_quiz", icon: "🎯", tier: "bronze", title: "البداية", desc: "أنهِ أول اختبار فردي", check: (s) => [s.attempts, 1] },
  { code: "quizzes_5", icon: "📚", tier: "silver", title: "مثابر", desc: "أنهِ 5 اختبارات", check: (s) => [s.attempts, 5] },
  { code: "quizzes_20", icon: "🏃", tier: "gold", title: "لا يتوقف", desc: "أنهِ 20 اختباراً", check: (s) => [s.attempts, 20] },
  { code: "score_80", icon: "⭐", tier: "silver", title: "متفوق", desc: "احصل على 80% أو أكثر في اختبار من 10 أسئلة فأكثر", check: (s) => [s.best10, 80] },
  { code: "perfect", icon: "💯", tier: "gold", title: "العلامة الكاملة", desc: "احصل على 100% في اختبار من 10 أسئلة فأكثر", check: (s) => [s.best10, 100] },
  { code: "full_80", icon: "🪐", tier: "gold", title: "الاختبار الشامل", desc: "احصل على 80% في اختبار من كل الوحدات (20 سؤالاً فأكثر)", check: (s) => [s.bestFull, 80] },
  { code: "correct_100", icon: "✅", tier: "silver", title: "مئة إجابة صحيحة", desc: "أجب 100 إجابة صحيحة", check: (s) => [s.correct, 100] },
  { code: "correct_500", icon: "🧠", tier: "gold", title: "خمسمئة إجابة صحيحة", desc: "أجب 500 إجابة صحيحة", check: (s) => [s.correct, 500] },
  { code: "unit_master", icon: "🎓", tier: "silver", title: "متقن وحدة", desc: `دقة 90% أو أكثر في وحدة واحدة (${MIN_UNIT} إجابات على الأقل)`, check: (s) => [s.bestUnit, 90] },
  { code: "all_round", icon: "🧭", tier: "gold", title: "متكامل", desc: `دقة 75% أو أكثر في الوحدات الست (${MIN_UNIT} إجابات على الأقل في كل وحدة)`, check: (s) => [s.strongUnits, UNIT_COUNT] },
  { code: "improver", icon: "📈", tier: "silver", title: "في تحسّن", desc: "ارفع نسبتك 20 نقطة عن أول اختبار", check: (s) => [s.improvement, 20] },
  { code: "streak_3", icon: "🔥", tier: "silver", title: "ثلاثة أيام متتالية", desc: "تدرّب ثلاثة أيام متتالية", check: (s) => [s.streak, 3] },
  { code: "streak_7", icon: "⚡", tier: "gold", title: "أسبوع كامل", desc: "تدرّب سبعة أيام متتالية", check: (s) => [s.streak, 7] },
];

const riyadhDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

function longestStreak(dates) {
  const days = [...new Set(dates.map(riyadhDay))].sort().map((d) => Date.parse(d) / 86400000);
  let best = 0, run = 0;
  days.forEach((d, i) => { run = i && d - days[i - 1] === 1 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

async function userStats(userId) {
  const [results, groups] = await Promise.all([
    pool.query("SELECT percent, total, units, created_at FROM results WHERE user_id = $1 ORDER BY created_at", [userId]),
    pool.query(`SELECT unit, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE correct)::int AS c
                FROM answers WHERE user_id = $1 GROUP BY unit`, [userId]),
  ]);
  const r = results.rows, g = groups.rows;
  const max = (a) => (a.length ? Math.max(...a) : 0);
  const totals = g.reduce((acc, x) => ({ n: acc.n + x.n, c: acc.c + x.c }), { n: 0, c: 0 });
  const pct = (x) => Math.round((x.c / x.n) * 100);
  const rated = g.filter((x) => x.n >= MIN_UNIT);
  return {
    attempts: r.length,
    best10: max(r.filter((x) => x.total >= 10).map((x) => x.percent)),
    bestFull: max(r.filter((x) => x.total >= 20 && x.units.length === UNIT_COUNT).map((x) => x.percent)),
    correct: totals.c,
    answered: totals.n,
    bestUnit: max(rated.map(pct)),
    strongUnits: rated.filter((x) => pct(x) >= 75).length,
    improvement: r.length > 1 ? Math.max(0, max(r.slice(1).map((x) => x.percent)) - r[0].percent) : 0,
    streak: longestStreak(r.map((x) => x.created_at)),
    avg: r.length ? Math.round(r.reduce((a, x) => a + x.percent, 0) / r.length) : null,
    best: r.length ? max(r.map((x) => x.percent)) : null,
    last: r.length ? r[r.length - 1].percent : null,
  };
}

function levelFor(xp) {
  let i = LEVELS.length - 1;
  while (xp < LEVELS[i][0]) i--;
  const [from, title] = LEVELS[i], next = LEVELS[i + 1];
  return { number: i + 1, title, xp, from, to: next ? next[0] : null, next_title: next ? next[1] : null };
}

// Recomputes a student's achievements, stores newly earned ones, and returns the full picture.
async function evaluate(userId) {
  const stats = await userStats(userId);
  const checked = DEFS.map((d) => { const [cur, goal] = d.check(stats); return { d, cur, goal, done: cur >= goal }; });
  const earnedNow = checked.filter((x) => x.done).map((x) => x.d.code);
  const fresh = earnedNow.length
    ? (await pool.query(
        `INSERT INTO achievements (user_id, code) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING RETURNING code`,
        [userId, earnedNow])).rows.map((x) => x.code)
    : [];
  const { rows } = await pool.query("SELECT code, earned_at FROM achievements WHERE user_id = $1", [userId]);
  const earnedAt = Object.fromEntries(rows.map((x) => [x.code, x.earned_at]));
  const list = checked.map(({ d, cur, goal }) => ({
    code: d.code, icon: d.icon, tier: d.tier, title: d.title, desc: d.desc, xp: TIER_XP[d.tier],
    earned_at: earnedAt[d.code] || null, progress: Math.min(cur, goal), goal,
  }));
  const xp = stats.correct * XP_PER_CORRECT + list.filter((a) => a.earned_at).reduce((a, x) => a + x.xp, 0);
  return { stats, achievements: list, level: levelFor(xp), new_achievements: list.filter((a) => fresh.includes(a.code)) };
}

module.exports = { evaluate };
