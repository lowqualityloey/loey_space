import * as fs from 'fs';
import * as path from 'path';
import type { App, TFile } from 'obsidian';
import type { QuickAddParams } from './types';
import { formatGeminiFailure } from './lib/gemini';
import { buildConceptNoteMarkdown, distillConceptsFromContent } from './lib/distiller';
import { replaceSectionBody } from './lib/markdown';

function isTFile(file: any): file is TFile {
  return Boolean(file && typeof file === 'object' && 'extension' in file && 'path' in file);
}

function resolveVaultPath(): string {
  const fromCwd = process.cwd();
  if (fs.existsSync(path.join(fromCwd, '08-Concepts')) || fs.existsSync(path.join(fromCwd, '06-Resources'))) {
    return fromCwd;
  }
  let current = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(current, '08-Concepts')) || fs.existsSync(path.join(current, '06-Resources'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

async function distillConceptAction(params?: QuickAddParams): Promise<void> {
  const app = params?.app || (typeof window !== 'undefined' ? (window as any).app : (globalThis as any).app);
  const Notice = typeof window !== 'undefined' ? (window as any).Notice : (globalThis as any).Notice;

  if (!app) {
    runCli();
    return;
  }

  const file = app.workspace.getActiveFile();
  if (!file || !isTFile(file)) {
    if (Notice) new Notice('⚠️ Please open an article or note to distill!');
    return;
  }

  if (Notice) new Notice(`🧠 Distilling evergreen concepts from "${file.basename}"...`);

  let geminiApiKey = '';
  try {
    const envContent = await app.vault.adapter.read('.env');
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes('your_gemini')) geminiApiKey = match[1].trim();
  } catch (e) {}

  if (!geminiApiKey) {
    if (Notice) new Notice('⚠️ GEMINI_API_KEY missing in .env!');
    return;
  }

  const existingConcepts = app.vault.getMarkdownFiles()
    .filter((f: TFile) => f.path.startsWith('08-Concepts') && !f.basename.startsWith('_'))
    .map((f: TFile) => f.basename);

  let content = await app.vault.read(file);
  const { concepts, model, failure } = await distillConceptsFromContent(
    geminiApiKey,
    content,
    file.basename,
    existingConcepts
  );

  if (!concepts || concepts.length === 0) {
    if (Notice) {
      new Notice(`⚠️ Could not distill concepts: ${formatGeminiFailure(failure)}`, 8000);
    }
    return;
  }

  const createdLinks: string[] = [];

  for (const concept of concepts) {
    const safeTitle = concept.title.replace(/[\\/:*?"<>|]/g, '').trim();
    if (!safeTitle) continue;

    const notePath = `08-Concepts/${safeTitle}.md`;
    const noteMarkdown = buildConceptNoteMarkdown(concept, file.basename);

    const existingAbstract = app.vault.getAbstractFileByPath(notePath);
    if (existingAbstract && isTFile(existingAbstract)) {
      await app.vault.modify(existingAbstract, noteMarkdown);
    } else {
      await app.vault.create(notePath, noteMarkdown);
    }

    createdLinks.push(`[[${safeTitle}]]`);
  }

  // Update source note with extracted concepts link section
  if (createdLinks.length > 0) {
    const linksBody = `*Atomic evergreen concepts distilled from this note:*\n` +
      createdLinks.map(l => `- ${l}`).join('\n');

    if (/^## 💡 Extracted (?:Evergreen )?Concepts/m.test(content)) {
      content = replaceSectionBody(content, '## 💡 Extracted Evergreen Concepts', linksBody);
    } else {
      content = content.replace(/\s*$/, '') + `\n\n---\n\n## 💡 Extracted Evergreen Concepts\n${linksBody}\n`;
    }

    await app.vault.modify(file, content);
  }

  if (Notice) {
    new Notice(`✨ Distilled ${createdLinks.length} concept(s) into 08-Concepts/ with ${model}!`, 6000);
  }
}

function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  const targetRelPath = args.find((a) => !a.startsWith('-'));

  console.log('🧠 Automatic Concept Distiller (CLI Mode)...');
  console.log(`📂 Vault Root: ${vaultRoot}\n`);

  let geminiApiKey = '';
  try {
    const envContent = fs.readFileSync(path.join(vaultRoot, '.env'), 'utf8');
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes('your_gemini')) geminiApiKey = match[1].trim();
  } catch (e) {}

  if (!geminiApiKey) {
    console.error('❌ GEMINI_API_KEY missing in .env!');
    process.exit(1);
  }

  let targetFile = targetRelPath;
  if (!targetFile) {
    const articlesDir = path.join(vaultRoot, '06-Resources/Articles');
    if (fs.existsSync(articlesDir)) {
      const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md') && !f.startsWith('_'));
      if (files.length > 0) {
        targetFile = path.join('06-Resources/Articles', files[0]).replace(/\\/g, '/');
      }
    }
  }

  if (!targetFile) {
    console.error('⚠️ No target file specified. Usage: node distill-concept-action.js <path/to/note.md>');
    process.exit(1);
  }

  const fullPath = path.isAbsolute(targetFile) ? targetFile : path.join(vaultRoot, targetFile);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Target file does not exist: ${fullPath}`);
    process.exit(1);
  }

  const basename = path.basename(fullPath, '.md');
  let content = fs.readFileSync(fullPath, 'utf8');

  console.log(`📖 Analyzing: "${basename}" (${targetFile})...\n`);

  const conceptsDir = path.join(vaultRoot, '08-Concepts');
  if (!fs.existsSync(conceptsDir)) {
    fs.mkdirSync(conceptsDir, { recursive: true });
  }

  const existingConcepts = fs.readdirSync(conceptsDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .map(f => path.basename(f, '.md'));

  (async () => {
    const { concepts, model, failure } = await distillConceptsFromContent(
      geminiApiKey,
      content,
      basename,
      existingConcepts
    );

    if (!concepts || concepts.length === 0) {
      console.error(`❌ Could not distill concepts: ${formatGeminiFailure(failure)}`);
      process.exit(1);
    }

    console.log(`🎉 Distilled ${concepts.length} atomic concept(s) using ${model}:\n`);
    const createdLinks: string[] = [];

    for (const concept of concepts) {
      const safeTitle = concept.title.replace(/[\\/:*?"<>|]/g, '').trim();
      const notePath = path.join(conceptsDir, `${safeTitle}.md`);
      const noteMarkdown = buildConceptNoteMarkdown(concept, basename);

      fs.writeFileSync(notePath, noteMarkdown, 'utf8');
      console.log(`  💡 Created: 08-Concepts/${safeTitle}.md`);
      console.log(`     Summary: ${concept.summary}`);
      createdLinks.push(`[[${safeTitle}]]`);
    }

    const linksBody = `*Atomic evergreen concepts distilled from this note:*\n` +
      createdLinks.map(l => `- ${l}`).join('\n');

    if (/^## 💡 Extracted (?:Evergreen )?Concepts/m.test(content)) {
      content = replaceSectionBody(content, '## 💡 Extracted Evergreen Concepts', linksBody);
    } else {
      content = content.replace(/\s*$/, '') + `\n\n---\n\n## 💡 Extracted Evergreen Concepts\n${linksBody}\n`;
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`\n✅ Updated source note with backlinks!`);
  })();
}

if (require.main === module) {
  runCli();
}

export = Object.assign(distillConceptAction, {
  buildConceptNoteMarkdown
});
