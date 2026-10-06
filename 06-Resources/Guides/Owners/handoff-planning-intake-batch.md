---
created: 2026-09-16
updated: 2026-09-16
type: resource
area: general
status: active
tags:
  - type/resource
  - area/general
  - topic/promptkit-os
---
# Handoff Brief: Planning-Intake Batch (Issues #178–#185)

> Owner-only handoff record for `lowqualityloey/promptkit-os`. Not a concept — do not link from the Concepts MOC.

You are executing issues #178–#185 in `lowqualityloey/promptkit-os`. Read this whole brief before your first edit. Every fact below was verified by running commands against commit `76e3168`. Re-run the verification block at the end of this brief to confirm your starting point matches — if it doesn't, stop and reconcile before editing.

The issues are well-written and their cited evidence is accurate. Do **not** rewrite them. Your job is to execute them with five corrections applied. The corrections exist because the issues, as written, will either fail CI, silently no-op, or ship a user-facing regression.

---

## 0. Blocking prerequisite: the referenced spec does not exist

All eight issues cite `**Related Spec**: docs/specs/2026-09-16-spec-planning-intake.md`. That file is not in the repo:

```bash
ls docs/specs/2026-09-16-spec-planning-intake.md   # No such file or directory
ls docs/specs/                                      # only three jit-spec-*.md files
grep -rl "discovery-intake" . --exclude-dir=.git    # zero hits
```

`protocols/discovery-intake.md` does not exist either. #178's deliverable is `§A–§G` of that protocol, and #182 cites `§E` / #184 cites `§F` as reference-only dependencies.

**Action:** Before #178, write `docs/specs/2026-09-16-spec-planning-intake.md` and commit it, deriving `§A–§G` from the invariant and task lists already present in issues #178, #182, and #184. Do not invent section content beyond what those three issues state. If the spec surfaces later from the author, reconcile rather than overwrite.

---

## 1. Hard constraints (violating any one of these fails CI or breaks users)

| # | Constraint | Why |
|---|---|---|
| C1 | **Do not add a single token to `templates/agent-directive-template.md`.** | Balanced static is **2,496 of a 2,500 budget** — 4 tokens of headroom. Any directive growth fails `measure-tokens.sh --strict`. All eight issues already exclude directive edits; keep it that way. Route intake signalling through `PROMPTKIT.md` instead (this is what #180 does, correctly). |
| C2 | **The literal string `Interactive Decision & Trade-Off Clarification` must survive in `workflows/plan.md`.** | Asserted at `scripts/tests/run-behavioral-contract-tests.sh:112` and `run-behavioral-contract-tests.ps1:106`. You may rewrite the *guidance under* that heading; you may not remove the heading text. |
| C3 | **Do not disturb the single Turbo human-approval line in `workflows/onboard.md`.** | `scripts/measure-turbo-overhead.sh:89` (the issues say `:90` — off by one) greps 4 sources and requires `INV_COUNT >= 3`. It currently reports exactly **3**. Per-file match counts: `templates/lite-profile.md` → 3, `init.sh` → 2, `workflows/onboard.md` → **1**, `workflows/profile.md` → **0**. `onboard.md` is one of the three counted and has no spare occurrence. Losing it drops to 2/4 and fails `--strict`. |
| C4 | **`validate-references.sh` resolves `.promptkit/protocols/*.md` references** (lines 116–122). | Do not register `protocols/discovery-intake.md` in `protocols/setup.md` (#185 task 4) before the file exists. Mechanically enforced ordering: #178 before #185. |
| C5 | **`profile:` and `tracking:` machine lines keep their exact format.** | `templates/project-profile-template.md:15` (`profile: balanced`) and `:128` (`tracking: local`). Parsers depend on them. New `size:` line must mirror the pattern exactly. |
| C6 | **No new `pk:` trigger.** | The orphaned-trigger check in `scripts/validate-references.sh` (lines 133–156) will flag it. Workflow count must stay at 23 (drift guard at `run-behavioral-contract-tests.sh:169`). |

---

## 2. Sequencing: two hard dependencies, both silently breakable

```
#186 spec  ──► #178 (protocol §A–§G)  ──┬─► #179  (Phase 0 greenfield intake)
                                        ├─► #182  (§E MVP floor)
                                        └─► #184  (§F delta path)

#180 (template signals)  ──► #181 (Step 0 preflight)  ──► #183 (benchmark refresh)
                                                          #185 (docs/registry)
```

**D1 — #180 must land before #181, not after.** #181's Scenario 1 is *"Given PROMPTKIT.md with `Intake Status: unanswered`"*. That field does not exist until #180 adds it. If you build #181 first, Step 0 reads a field that is never present, the preflight never fires, and **all three of #181's acceptance criteria still pass**. This is a silent no-op on a P0. Build #180 first and confirm the field is on disk before starting #181.

**D2 — #178 must land before #185.** See C4.

**D3 — #183 must land last, in the same batch.** #179 and #181 grow `workflows/onboard.md` and `workflows/plan.md`, which moves the per-task numbers #183 publishes. Refreshing benchmarks before those edits means refreshing them twice.

---

## 3. Correction 1 — two issues ship verification commands that cannot run

#178 and #179 both specify:

```bash
bash .promptkit/scripts/validate-references.sh .
bash .promptkit/scripts/tests/run-behavioral-contract-tests.sh
```

There is no `.promptkit/` directory in this repo — that is the *consumer* install path, not a source path. `scripts/validate-references.sh:7` is `PROMPTKIT_DIR="${1:-.promptkit}"`, so `.promptkit` is the default *argument*. Run as written, both commands exit with "No such file or directory."

**Use instead** (the form #180–#185 already use correctly):

```bash
bash scripts/validate-references.sh .
bash scripts/tests/run-behavioral-contract-tests.sh
```

---

## 4. Correction 2 — #183's scope misses the Lite drift, which is proportionally worse

#183 correctly identifies the Balanced drift: docs say **2,319 tok / 9,276 chars**, live is **2,496 / 9,985**. Verified mechanically:

```
templates/agent-directive-template.md      9985 chars -> 2496 tok
templates/agent-directive-lite-template.md 4237 chars -> 1059 tok
```

But **Lite has drifted too, and #183 does not mention it.** Docs say **961 tok**; live is **1,059** — a 98-token (10%) drift. Stale `961` occurrences to fix:

- `docs/BENCHMARKS.md` lines **24, 40, 56, 57, 80, 89** (line 57 also says "Lite stays at 961 tok — skipped silently")
- `README.md` lines **23, 60, 84, 334, 342**

Also fix `docs/BENCHMARKS.md:88`, which is internally inconsistent on its own: `JIT payload = directive 1,929-2,319 + workflow + gate`.

`docs/token-efficiency-review.md:32` says "~1,878 tokens" and `:41` says `directive 1,882` — both already in #183's scope, both confirmed stale.

Keep the dated historical baseline at `docs/BENCHMARKS.md:189` (`Measured (main @ 719a74e, directive 2,319 tok)`) **labelled as a dated measurement**. Do not rewrite history to match the present.

**Budgets do not change:** Balanced ≤ 2,500 and Lite ≤ 1,500 stay as the gates.

---

## 5. Correction 3 — #181's picker rule is scoped too narrowly to hold

`workflows/plan.md:127` currently instructs:

> When resolving architectural choices or ambiguous requirements, prioritize native interactive selection tools (e.g. OpenCode question prompt, `ask_question`) with option 1 prefixed `(Recommended)`.

This is exactly what #181 forbids: the workflow tells the agent to put its own preference at Option 1 on intent questions. Fixing `plan.md` is necessary but not sufficient — the same unconditional pattern lives in at least these places:

```
workflows/commit.md:216    workflows/fix.md:129     workflows/sync.md:74
workflows/data.md:204      workflows/test.md:220    workflows/pr.md:149
workflows/profile.md:39    workflows/onboard.md:130,138,151,161
FAQ.md:532                 README.md:295            CHANGELOG.md:21
```

Most of these read *"when multiple next steps exist, invoke ... with Option 1 `(Recommended)`"* — with no carve-out for intent questions. An agent following `sync.md` or `commit.md` guidance on an MVP-scope question will still violate #181's invariant.

**Action:** Either (a) add a bounded-decision carve-out to the blanket guidance in the workflow files above, or (b) record explicitly in #181 that they are out of scope and state why. Do not leave it unstated — the invariant will read as enforced while remaining unenforceable. Note that the `onboard.md` profile/tracker pickers and `profile.md` are legitimately bounded closed-set decisions and should keep their pickers.

---

## 6. Correction 4 — #185 will silently falsify three "17 questions" claims

`FAQ.md` has exactly 17 entries (`## 1.` at line 7 through `## 17.` at line 565). #185 task 3 adds an intake FAQ entry, making 18. The count "17" is asserted in three places:

```
FAQ.md:3       **The 17 questions every developer asks before adopting PromptKit OS.**
README.md:50   See **[FAQ.md](./FAQ.md)** for the 17 most common questions
README.md:354  ├── FAQ.md   # The 17 questions every developer asks before adopting
```

Unlike the workflow count, **there is no test guarding the FAQ count.** This will drift silently. Add all three files to #185's Files Touched, or phrase the new entry so the count stays honest.

Scope note on #185's premise: `grep -i greenfield QUICKSTART.md FAQ.md` returns **nothing** — those two genuinely lack greenfield coverage. But greenfield *is* mentioned elsewhere (`README.md:86`, `README.md:156`, `docs/WORKFLOW-MAP.md:72`, `workflows/route.md:197`) in different contexts (version pinning, RFC-vs-ingestion). Don't overclaim the gap in your commit message; the real gap is the *intake path*, not the word.

---

## 7. Correction 5 — #181 has an undefined `partial` boundary that can ship a regression

#180's invariant: a missing `Intake Status:` must be treated as `partial (legacy)` so existing installs are **never re-grilled**.

#181's acceptance criteria cover only two states:
- Scenario 1: `Intake Status: unanswered` → run bounded intake or route to `pk:onboard`
- Scenario 2: `Intake Status: complete` → 2-line check, proceed

**Neither says what Step 0 does with `partial (legacy)`.** If "incomplete" is read to include `partial`, every existing install gets interviewed on its first `pk:plan` — exactly what #180 forbids, and a worse experience than the bug being fixed.

**Action:** Add this acceptance criterion to #181 before implementing Step 0:

> ### Scenario 4: Legacy partial intake
> - **Given** a PROMPTKIT.md with `Intake Status: partial` (or the field absent entirely)
> - **When** `pk:plan` starts
> - **Then** Step 0 asks only for the specific missing critical slot, never a full re-interview, and records the result without downgrading the status

---

## 8. Facts you can rely on (verified, don't re-litigate)

- `workflows/onboard.md:26` precondition: *"The repository contains existing application code, manifests, or configuration files."* An empty repo genuinely fails it — #179's premise is correct.
- `workflows/onboard.md:1` is titled `# Brownfield Codebase Intake & Onboarding Workflow` with a `4-Phase Onboarding Protocol` — the retitle in #179 is accurate.
- `workflows/plan.md` step headings are at lines **119, 130, 141, 149, 163, 192** (Steps 1–6). There is no Step 0 — the slot is free.
- `templates/project-profile-template.md` has **20** `[e.g. ...]` placeholders and no `size:` or `Intake Status:` today — #180's premise is correct.
- `protocols/context-sync.md:26` has an `Authority & Scope` table under `### 1.1. Standard Root Documentation Inspection` — #184's "Product & Design Inputs" row slots in there.
- `workflows/route.md:141` has only an `Existing Repo / Brownfield Intake` row — #185's registry gap is real.
- `workflows/plan.md:103` (`Minimal-to-Controlled Readiness Mapping`) governs Task Record *readiness*, not scope. #182 does not duplicate it.

---

## 9. Verification

**Baseline at `76e3168` — confirm you match this before editing:**

```bash
bash scripts/tests/run-behavioral-contract-tests.sh    # Passed: 81 | Failed: 0
bash scripts/measure-tokens.sh --strict                # BALANCED|2496|2500|PASS  LITE|1059|1500|PASS
bash scripts/measure-per-task-tokens.sh --strict       # 6x BASELINE|...|PASS, exit 0
bash scripts/measure-turbo-overhead.sh --strict        # AC-3 invariant: OK (... 3 shipped sources), exit 0
bash scripts/validate-references.sh .                  # ✅ All references valid!
```

Per-task reference values: `pk:fix` 6,722 | `pk:plan` 15,539 (baseline 24,666) | `pk:ship` 11,879.

**Re-run all five after every issue, not just at the end.** The two most likely failures are C3 (turbo guard, if you touched `onboard.md`) and C1 (token budget, if anything leaked into the directive).

**Known gap in this brief:** the `.ps1` test twins were **not executed** — `pwsh` is not installed in the review sandbox. The assertion string was confirmed present at `run-behavioral-contract-tests.ps1:106`, but the PowerShell suite itself is unverified. #181 explicitly requires the `.sh`/`.ps1` twins stay green; that needs a real pwsh run before merge. If you have pwsh, run `scripts/tests/run-behavioral-contract-tests.ps1` and `scripts/measure-tokens.ps1` too.

---

## 10. Definition of done

For each issue: every invariant checkbox satisfied, every acceptance criterion demonstrably met (including the new Scenario 4 on #181), all five verification commands green, `.sh`/`.ps1` parity maintained, and no directive-token growth. Report actual command output in your summary — not "tests pass."
````