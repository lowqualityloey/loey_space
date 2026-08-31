import type { App, TFile, TFolder } from 'obsidian';

export interface QuickAddApi {
  inputPrompt(header: string, placeholder?: string, value?: string): Promise<string | undefined>;
  suggester(displayItems: string[] | ((item: any) => string), actualItems: any[]): Promise<any>;
  checkboxPrompt(items: string[], selectedItems?: string[]): Promise<string[] | undefined>;
  datePrompt?(header: string, format?: string): Promise<string | undefined>;
}

export interface QuickAddParams {
  app?: App;
  quickAddApi?: QuickAddApi;
  variables?: Record<string, any>;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}

export interface RouteConfig {
  kind: 'task' | 'drop' | 'note' | 'project';
  folder?: string;
  type?: string;
  area?: string;
  status?: string;
  review?: string;
  priority?: string;
}

export interface KanbanItem {
  id?: string;
  title: string;
  rawTitle?: string;
  status: string;
  priority?: string | null;
  section?: string;
  checkbox?: string;
  completionDate?: string | null;
  rawText?: string;
}

export interface DailyNoteExtraction {
  date: string;
  habits: {
    fitness: boolean;
    reading: boolean;
    coding: boolean;
    meditation: boolean;
  };
  metrics: {
    mood: string;
    energy: string;
    sleepHours: string;
    focusHours: string;
  };
  taskCounts: {
    completed: number;
    pending: number;
  };
  rawTasks: string[];
  logHighlights: string[];
}
