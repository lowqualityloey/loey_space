/**
 * Bundle entry for the shared task-view rules.
 *
 * Dataview evaluates `dv.load()` targets as plain scripts with no module system,
 * so the task views cannot import these rules. Publishing them on globalThis
 * gives every view one source of truth for the shield, promotion and identity
 * behaviour instead of each view re-implementing it.
 *
 * Built to 06-Resources/scripts/task-view.js by `npm run build`.
 */

import { installOnGlobal } from "./lib/task-view";

installOnGlobal();

export {};