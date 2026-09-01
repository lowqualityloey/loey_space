---
name: vault-hygiene-auditor
description: >-
  Audits vault health by validating frontmatter properties and tag taxonomy, scanning for broken
  wikilinks, verifying secret leak exclusion (.secrets/ and .env), and flagging stale notes.
---

# 🛡️ Vault Hygiene Auditor Skill

This skill guides the agent in running routine health audits, ensuring metadata consistency, finding dead links, and verifying Git secret safety.

---

## 🎯 When to Activate
- The user runs `hey loey health` or `hey loey audit`.
- The user requests a security or consistency check across the vault.
- Before committing large changes or making major structural reorganizations.

---

## 📋 Procedure

### Step 1: Frontmatter & Tag Taxonomy Validation
1. Run or check against `06-Resources/scripts/validate-templates.js` and `06-Resources/Guides/Tagging & Properties.md`.
2. Check that notes have required frontmatter fields:
   - Universal: `created`, `updated`, `type`, `area`, `status`, `tags`
   - Specific: `review_cycle` on concepts/learning, `priority` on projects.
3. Ensure tags use namespaced structure: `type/*`, `area/*`, `topic/*`.

### Step 2: Broken Wikilink Scan
1. Scan markdown files for `[[Target Note]]` references.
2. Verify that `Target Note.md` exists within the vault.
3. Flag any dead links or orphaned files (files not linked from their respective MOC).

### Step 3: Git Secret Leak Audit
1. Verify that `.env` and `.secrets/` are ignored in `.gitignore`.
2. Scan staged files or recently edited markdown notes for accidental credential exposure:
   - Google AI / Gemini: `AIza[0-9A-Za-z_-]{35}`
   - OpenAI: `sk-[A-Za-z0-9]{32,}` or `sk-proj-`
   - GitHub PATs: `ghp_`, `github_pat_`
   - AWS Keys: `AKIA[0-9A-Z]{16}`
   - Private Keys: `-----BEGIN [A-Z ]*PRIVATE KEY-----`
3. Report any violations immediately for revocation and rotation.

### Step 4: Stale Note & Overdue Review Scan
1. Inspect `08-Concepts/` for notes where `last_reviewed` > 90 days ago.
2. Inspect `04-Learning/` for notes where `last_reviewed` > 30 days ago.
3. Present a tidy summary report with actionable next steps.
