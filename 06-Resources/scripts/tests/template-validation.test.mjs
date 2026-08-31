import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const TEMPLATES_DIR = path.resolve(process.cwd(), "99-Templates");

test("template validation: all 19 templates have valid YAML frontmatter and types", () => {
  assert.ok(fs.existsSync(TEMPLATES_DIR), "99-Templates directory must exist");
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith(".md"));
  assert.ok(files.length >= 19, "Must contain at least 19 template files");

  for (const file of files) {
    const fullPath = path.join(TEMPLATES_DIR, file);
    const content = fs.readFileSync(fullPath, "utf8");

    assert.ok(content.startsWith("---"), `${file} must start with YAML frontmatter delimiter (---)`);
    const endMatch = content.slice(3).indexOf("---");
    assert.ok(endMatch !== -1, `${file} must have closing YAML frontmatter delimiter (---)`);

    const fm = content.slice(3, endMatch + 3);
    const typeMatch = fm.match(/type:\s*([a-zA-Z0-9_-]+)/);
    assert.ok(typeMatch, `${file} must declare a non-empty type field in frontmatter`);
  }
});
