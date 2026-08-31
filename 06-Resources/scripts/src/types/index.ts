import { App, TFile } from 'obsidian';

export interface QuickAddApi {
  inputPrompt(header: string, placeholder?: string, value?: string): Promise<string>;
  suggester(displayItems: string[], actualItems: string[]): Promise<string>;
  checkboxPrompt(items: string[], selectedItems?: string[]): Promise<string[]>;
}

export interface QuickAddParams {
  app: App;
  quickAddApi?: QuickAddApi;
  variables?: Record<string, any>;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}
