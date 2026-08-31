import type { App as ObsidianApp, Notice as ObsidianNotice } from 'obsidian';

declare global {
  var app: ObsidianApp;
  var Notice: typeof ObsidianNotice;
  var requestUrl: (params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    throw?: boolean;
  }) => Promise<{ status: number; text: string; json: any; headers: Record<string, string> }>;

  interface Window {
    app: ObsidianApp;
    Notice: typeof ObsidianNotice;
    requestUrl: (params: any) => Promise<any>;
  }
}

export {};
