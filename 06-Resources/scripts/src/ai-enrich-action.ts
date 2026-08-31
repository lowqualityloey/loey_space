import type { App, TFile } from 'obsidian';
import type { QuickAddParams } from './types';
import { enrichConceptNote } from './lib/enrichers/concept';
import { enrichDevNote } from './lib/enrichers/dev';
import { enrichLearningNote } from './lib/enrichers/learning';
import { enrichDailyNote } from './lib/enrichers/daily';

export = async function aiEnrichAction(params?: QuickAddParams): Promise<void> {
  const app = params?.app || (window as any).app || (globalThis as any).app;
  const Notice = (window as any).Notice || (globalThis as any).Notice;
  const file = app.workspace.getActiveFile();

  if (!file) {
    new Notice("⚠️ Please open a note first!");
    return;
  }

  const isDaily = file.path.startsWith("01-Daily");
  const isConcept = file.path.startsWith("08-Concepts");
  const isDev = file.path.startsWith("03-Dev");
  const isLearning = file.path.startsWith("04-Learning");

  if (!isDaily && !isConcept && !isDev && !isLearning) {
    new Notice("⚠️ Please open a Daily, Concept, Dev, or Learning note first!");
    return;
  }

  if (isConcept) {
    await enrichConceptNote(app, file);
  } else if (isDev) {
    await enrichDevNote(app, file);
  } else if (isLearning) {
    await enrichLearningNote(app, file);
  } else {
    await enrichDailyNote(app, file);
  }
};
