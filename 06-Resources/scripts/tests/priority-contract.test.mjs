import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Issue #53: `priorityWeight` in `02-Projects/_Projects MOC.md` held only the word
// vocabulary (critical/high/medium/low), and the consumption site read
// `priorityWeight[p.priority] || 0`. Every project note declaring `priority: p0`
// therefore resolved to `undefined || 0` and was sorted as the LEAST important
// project — 7 real notes at the time of writing, with no error and no test.
//
// The ranking code lives in DataviewJS blocks, which Obsidian executes and a shell
// cannot, so nothing in the suite could see this class of defect. That is precisely why
// it survived review. This guard closes the gap by extracting the SHIPPED source text
// and evaluating it, rather than retyping a copy — a copy would prove nothing about
// what actually ships, and would keep passing after the file regressed.
//
// Scope, deliberately narrow:
//   * `_Projects MOC.md` is pinned to the full canonical mapping. That IS the #53 fix,
//     so a regression here is a real regression and must fail.
//   * `_Tasks MOC.md` is pinned to the full canonical mapping too. Until #95 landed the
//     word aliases there were off by one against § 5 (`high` ranked as Critical, `medium`
//     as High) and `critical` matched nothing at all, so the aliases were deliberately
//     left unpinned rather than cementing the defect. #95 fixed the function, so the whole
//     tag → rank table is now pinned and a reintroduced off-by-one must fail here.
//   * `urgent` and `normal` ARE pinned as unranked: removing them was a deliberate
//     drift decision, and a future edit quietly reinstating them should fail.

const REPO_ROOT = process.cwd();
const PROJECTS_MOC = path.join(REPO_ROOT, "02-Projects", "_Projects MOC.md");
const TASKS_MOC = path.join(REPO_ROOT, "01-Daily", "_Tasks MOC.md");

function dataviewjsBlock(file) {
  const text = readFileSync(file, "utf8");
  const blocks = [...text.matchAll(/```dataviewjs\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(
    blocks.length > 0,
    `${file} has no dataviewjs block — this guard reads shipped source, so a renamed ` +
      "fence or a moved block would otherwise make it pass vacuously"
  );
  return blocks.join("\n");
}

// --- _Projects MOC: priorityWeight map + the expression that consumes it ---------

function loadProjectsRanking() {
  const code = dataviewjsBlock(PROJECTS_MOC);

  const mapLiteral = code.match(/const priorityWeight = (\{[\s\S]*?\});/);
  assert.ok(mapLiteral, "could not extract `priorityWeight` from _Projects MOC.md");

  const weightLine = code.match(/^\s*weight: (.+?),?\s*$/m);
  assert.ok(weightLine, "could not extract the `weight:` consumption site from _Projects MOC.md");

  const priorityWeight = new Function(`return ${mapLiteral[1]};`)();
  // Built as a real row so the shipped expression is evaluated verbatim, including the
  // case normalisation added by #53. A `P0` must not be able to slip through to 0.
  const weightOf = new Function(
    "priorityWeight",
    `return (p) => ({ weight: ${weightLine[1].replace(/,$/, "")} });`
  )(priorityWeight);

  return { priorityWeight, weightOf };
}

// --- _Tasks MOC: getPriorityRank ------------------------------------------------

function loadTasksRanking() {
  const code = dataviewjsBlock(TASKS_MOC);
  const fn = code.match(/function getPriorityRank\(text\) \{[\s\S]*?\n\}/);
  assert.ok(fn, "could not extract `getPriorityRank` from _Tasks MOC.md");
  return new Function(`${fn[0]}; return getPriorityRank;`)();
}

test("the shipped priority sources are found, so this file cannot pass vacuously", () => {
  const { priorityWeight, weightOf } = loadProjectsRanking();
  const getPriorityRank = loadTasksRanking();

  assert.ok(
    Object.keys(priorityWeight).length >= 8,
    `expected priorityWeight to carry both canonical vocabularies, got ${Object.keys(priorityWeight).length} keys`
  );
  assert.equal(typeof weightOf({ priority: "p0" }).weight, "number");
  assert.equal(typeof getPriorityRank("#priority/p0"), "number");
});

test("#53: p0-p3 and their word equivalents resolve to the SAME rank", () => {
  const { weightOf } = loadProjectsRanking();

  // `Tagging & Properties.md` § 5 sanctions both vocabularies for the same four levels.
  // Accepting one and not the other is what made every `p0` note score 0.
  for (const [numeric, word] of [
    ["p0", "critical"],
    ["p1", "high"],
    ["p2", "medium"],
    ["p3", "low"],
  ]) {
    assert.equal(
      weightOf({ priority: numeric }).weight,
      weightOf({ priority: word }).weight,
      `${numeric} and ${word} are the same level in § 5 and must rank identically`
    );
  }
});

test("#53: the four canonical levels rank in strict descending order", () => {
  const { weightOf } = loadProjectsRanking();

  const ranks = ["p0", "p1", "p2", "p3"].map((p) => weightOf({ priority: p }).weight);
  assert.deepEqual(
    ranks,
    [...ranks].sort((a, b) => b - a),
    `expected p0 > p1 > p2 > p3, got ${ranks.join(" >= ")}`
  );
  assert.ok(ranks[0] > ranks[3], "p0 must outrank p3");
});

test("#53: a p0 project outranks every lower level — the exact regression", () => {
  const { weightOf } = loadProjectsRanking();

  // Pre-fix this was `weightOf({ priority: "p0" }) === 0`, tying p0 with `none` and
  // below every real level, so the sort put the most urgent projects last.
  // `critical` is deliberately absent: it is p0's own canonical equivalent, so it
  // must TIE rather than rank below — the equality is asserted in the test above.
  const p0 = weightOf({ priority: "p0" }).weight;
  for (const lower of ["p1", "p2", "p3", "high", "medium", "low", "none"]) {
    assert.ok(p0 > weightOf({ priority: lower }).weight, `p0 must outrank ${lower}`);
  }
});

test("#53: unknown and absent priorities fall back to 0 without throwing", () => {
  const { weightOf } = loadProjectsRanking();

  for (const value of [undefined, null, "", "bogus", "P0 "]) {
    assert.equal(weightOf({ priority: value }).weight, 0, `${JSON.stringify(value)} should score 0`);
  }
});

test("#53: priority matching is case-insensitive", () => {
  const { weightOf } = loadProjectsRanking();

  assert.equal(weightOf({ priority: "P0" }).weight, weightOf({ priority: "p0" }).weight);
  assert.equal(weightOf({ priority: "Critical" }).weight, weightOf({ priority: "critical" }).weight);
  assert.ok(weightOf({ priority: "P0" }).weight > 0, "an uppercase P0 must not score 0");
});

test("_Tasks MOC: p0-p3 rank in ascending urgency order", () => {
  const getPriorityRank = loadTasksRanking();

  // The numeric tags were always correct here, and stay correct across the #95 fix,
  // so they are safe to pin.
  const ranks = [0, 1, 2, 3].map((n) => getPriorityRank(`#priority/p${n}`));
  assert.deepEqual(ranks, [0, 1, 2, 3], `expected 0,1,2,3 — got ${ranks.join(",")}`);
});

test("#95: every canonical tag form ranks exactly as § 5 defines it", () => {
  const getPriorityRank = loadTasksRanking();

  // The shipped table, one level per row. Pre-fix this object read
  // `{ critical: 4, high: 0, medium: 1 }` against a canonical `{ 0, 1, 2 }` — the exact
  // defect #95 reported, pinned here so it cannot come back silently.
  assert.deepEqual(
    {
      p0: getPriorityRank("#priority/p0"),
      critical: getPriorityRank("#priority/critical"),
      p1: getPriorityRank("#priority/p1"),
      high: getPriorityRank("#priority/high"),
      p2: getPriorityRank("#priority/p2"),
      medium: getPriorityRank("#priority/medium"),
      p3: getPriorityRank("#priority/p3"),
      low: getPriorityRank("#priority/low"),
    },
    { p0: 0, critical: 0, p1: 1, high: 1, p2: 2, medium: 2, p3: 3, low: 3 }
  );
});

test("#95: the four canonical levels are distinct, ordered, and never unranked", () => {
  const getPriorityRank = loadTasksRanking();

  const levels = [
    ["p0", "critical"],
    ["p1", "high"],
    ["p2", "medium"],
    ["p3", "low"],
  ];

  const ranks = levels.map(([numeric, word]) => {
    const numericRank = getPriorityRank(`#priority/${numeric}`);
    const wordRank = getPriorityRank(`#priority/${word}`);
    assert.equal(
      numericRank,
      wordRank,
      `${numeric} and ${word} are the same level in § 5 and must rank identically`
    );
    return numericRank;
  });

  assert.deepEqual(ranks, [0, 1, 2, 3], `expected 0,1,2,3 — got ${ranks.join(",")}`);
  assert.equal(
    new Set(ranks).size,
    levels.length,
    "two levels sharing a rank is what made the word aliases sort incorrectly"
  );
  for (const rank of ranks) {
    assert.ok(rank < 4, "a canonical level must never fall through to the unranked value");
  }
});

test("#95: `critical` ranks 0 instead of falling through to unranked", () => {
  const getPriorityRank = loadTasksRanking();

  // The specific failure: `critical` appeared in no pattern, so the most urgent word
  // form was the only canonical alias that sorted as if it had no priority at all.
  assert.equal(getPriorityRank("#priority/critical"), 0);
  assert.equal(getPriorityRank("Ship it #priority/critical please"), 0, "matched inside surrounding text");
  assert.equal(getPriorityRank("#priority/CRITICAL"), 0, "case-insensitive, like the numeric forms");
  assert.notEqual(getPriorityRank("#priority/critical"), getPriorityRank("no tag here"));
});

test("#95: no canonical form can be read as a different level", () => {
  const getPriorityRank = loadTasksRanking();

  // Guards the specific confusion #95 was: a word form sharing a numeric form's rank.
  const wrong = [
    ["#priority/high", 0, "high is High, not Critical"],
    ["#priority/medium", 1, "medium is Medium, not High"],
    ["#priority/critical", 4, "critical is Critical, not unranked"],
  ];
  for (const [tag, forbidden, why] of wrong) {
    assert.notEqual(getPriorityRank(tag), forbidden, `${tag}: ${why}`);
  }
});

test("_Tasks MOC: urgent and normal stay unranked — deliberate drift removal", () => {
  const getPriorityRank = loadTasksRanking();

  // Neither is in the canonical § 5 taxonomy and a census of the real vault found 0
  // uses, so they were removed rather than carried as legacy aliases. 4 is the
  // unranked fallthrough. If a future edit reinstates them, that decision was reversed
  // without anyone deciding it.
  for (const alias of ["urgent", "normal"]) {
    assert.equal(
      getPriorityRank(`#priority/${alias}`),
      4,
      `#priority/${alias} must not rank; it was removed as drift, not carried as an alias`
    );
  }
});

test("_Tasks MOC: an unrecognised tag is unranked rather than guessed", () => {
  const getPriorityRank = loadTasksRanking();

  assert.equal(getPriorityRank("no priority tag here"), 4);
  assert.equal(getPriorityRank("#priority/pX"), 4, "#priority/pX is a template placeholder, not a level");
});
