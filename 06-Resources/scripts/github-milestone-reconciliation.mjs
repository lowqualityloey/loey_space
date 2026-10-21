export const STATE_VERSION = 1;

export function validateConfig(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.repositories) || !value.repositories.length) {
    throw new Error('Configure at least one repository (schemaVersion: 1).');
  }
  const repositories = [...new Set(value.repositories.map((repo) => {
    if (typeof repo !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(repo)) {
      throw new Error('Invalid GitHub repository in configuration.');
    }
    return repo.toLowerCase();
  }))];
  if (typeof value.startFrom !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value.startFrom) || !Number.isFinite(Date.parse(value.startFrom))) {
    throw new Error('startFrom must be an explicit ISO timestamp.');
  }
  const timeZone = value.timeZone || 'Pacific/Auckland';
  new Intl.DateTimeFormat('en', { timeZone }).format(new Date());
  return { schemaVersion: 1, repositories, timeZone, startFrom: new Date(value.startFrom).toISOString() };
}

export function validateState(value) {
  if (!value) return { schemaVersion: STATE_VERSION, scans: {}, receipts: {} };
  if (value.schemaVersion !== STATE_VERSION || !value.scans || !value.receipts ||
      typeof value.scans !== 'object' || Array.isArray(value.scans) ||
      typeof value.receipts !== 'object' || Array.isArray(value.receipts)) {
    throw new Error('Invalid reconciliation checkpoint; preserve it for inspection.');
  }
  for (const date of Object.values(value.scans)) {
    if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) throw new Error('Invalid scan timestamp.');
  }
  for (const receipt of Object.values(value.receipts)) {
    if (!receipt || typeof receipt.dailyPath !== 'string' || typeof receipt.mergedAt !== 'string' ||
        typeof receipt.mergeSha !== 'string') throw new Error('Invalid milestone receipt.');
  }
  return structuredClone(value);
}

export function scanSince(config, state, repository) {
  const last = state.scans[repository];
  const overlap = last ? Date.parse(last) - 86400000 : Date.parse(config.startFrom);
  return new Date(Math.max(Date.parse(config.startFrom), overlap)).toISOString();
}

export function localStamp(instant, timeZone) {
  const date = new Date(instant);
  if (!Number.isFinite(date.valueOf())) throw new Error('Invalid milestone timestamp.');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type).value;
  return { date: part('year') + '-' + part('month') + '-' + part('day'), time: part('hour') + ':' + part('minute') };
}

export function normalizePullRequest(repository, raw) {
  if (!raw || raw.merged !== true) return null;
  const number = raw.number;
  const url = 'https://github.com/' + repository + '/pull/' + number;
  if (!Number.isSafeInteger(number) || number < 1 ||
      String(raw.html_url).toLowerCase() !== url ||
      typeof raw.title !== 'string' ||
      typeof raw.merged_at !== 'string' || !Number.isFinite(Date.parse(raw.merged_at)) ||
      !/^[0-9a-f]{40,64}$/i.test(raw.merge_commit_sha || '')) {
    throw new Error('Incomplete or inconsistent merged PR metadata for ' + repository + '.');
  }
  return {
    repository, number, url, title: raw.title.replace(/[\r\n\t]+/g, ' ').trim(),
    mergedAt: new Date(raw.merged_at).toISOString(), mergeSha: raw.merge_commit_sha.toLowerCase()
  };
}

export function milestoneSummary(pr, timeZone) {
  const stamp = localStamp(pr.mergedAt, timeZone);
  const entities = { '<': '&lt;', '>': '&gt;', '[': '&#91;', ']': '&#93;', '`': '&#96;', '#': '&#35;' };
  const title = pr.title.replace(/[|\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/&/g, '&amp;').replace(/[<>\[\]`#]/g, (character) => entities[character]);
  return '[' + pr.repository + '] PR #' + pr.number + ' merged: ' + title +
    ' (' + pr.mergeSha.slice(0, 12) + '; ' + stamp.date + ' ' + stamp.time + ' ' + timeZone + '). ' +
    pr.url + ' <!-- loey-github:' + pr.repository + '#' + pr.number + ' -->';
}

function sectionLines(content, heading) {
  if (typeof content !== 'string') return [];
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return [];
  const level = heading.match(/^#+/)[0].length;
  const selected = [];
  let fence = '';
  for (const line of lines.slice(start + 1)) {
    const opening = line.match(/^\s*(`{3,}|~{3,})/);
    if (opening) {
      if (!fence) fence = opening[1][0];
      else if (opening[1][0] === fence) fence = '';
      continue;
    }
    if (fence) continue;
    const match = line.match(/^(#+)\s/);
    if (match && match[1].length <= level) break;
    selected.push(line);
  }
  return selected;
}

function legacyMergeEvidence(line, pr, allowShortScope) {
  const slug = pr.repository.split('/')[1];
  const scopes = (text) => [...text.toLowerCase().matchAll(/\[([^\]]+)\]|`([^`]+)`/g)]
    .map((match) => match[1] || match[2]).filter((scope) => scope !== 'x' && !/^\d/.test(scope));
  const matchesScope = (values) => values.length === 1 && (
    values[0] === pr.repository || values[0].startsWith(pr.repository + '/') ||
    (allowShortScope && (values[0] === slug || values[0].startsWith(slug + '/')))
  );
  const lineScopes = [...new Set(scopes(line))];
  for (const clause of line.split(/;|\.(?=\s|$)|\s+(?:and|but|while)\s+/i)) {
    if (/\?|\b(?:not|never|if|unless|whether|pending|unmerged|will|would|could|should|might|may|cannot)\b|\b\w+n['’]t\b/i.test(clause)) continue;
    const numbers = [...clause.matchAll(/\bPR\s*#(\d+)\b/gi)].map((match) => Number(match[1]));
    if (numbers.length !== 1 || numbers[0] !== pr.number) continue;
    const merged = /\bPR\s*#\d+\s*:?\s+(?:(?:was|is|has(?:\s+been)?)\s+)?(?:(?:already|successfully)\s+)?merged\b|\bmerged\s+PR\s*#\d+\b/i.test(clause);
    if (!merged) continue;
    const urls = [...clause.toLowerCase().matchAll(/https:\/\/github\.com\/[^\s)|]+\/pull\/\d+/g)].map((match) => match[0]);
    if (urls.length) {
      if (urls.every((url) => url === pr.url)) return true;
      continue;
    }
    const clauseScopes = [...new Set(scopes(clause))];
    if (matchesScope(clauseScopes.length ? clauseScopes : lineScopes)) return true;
  }
  return false;
}

const LOG_AREA_HEADINGS = ['### 🧍 Personal Log', '### 🤖 Agent Milestones', '### 🐙 GitHub Activity'];
const AGENT_AREA_HEADING = '### 🤖 Agent Milestones';

/** Plain table rows count only inside the agent-owned area; legacy quoted rows count anywhere. */
function dailyEvidenceLines(content) {
  if (typeof content !== 'string') return [];
  const logLines = sectionLines(content, '## 📝 Daily Log');
  const separated = LOG_AREA_HEADINGS.some((heading) =>
    content.split(/\r?\n/).some((line) => line.trim() === heading));
  const quoted = logLines.filter((line) => /^> \|/.test(line));
  if (separated) {
    return sectionLines(content, AGENT_AREA_HEADING).filter((line) => /^\|/.test(line)).concat(quoted);
  }
  // Legacy note with no separated areas: the whole Daily Log is the agent surface.
  return logLines.filter((line) => /^(?:> )?\|/.test(line) || /^- (?:\[x\] )?\*\*/.test(line));
}

export function recordContains(content, pr, kind, allowShortScope = true) {
  const lines = kind === 'daily' ? dailyEvidenceLines(content) :
    kind === 'handoff' ? sectionLines(content, '### Latest Updates') :
    typeof content === 'string' ? content.split(/\r?\n/) : [];
  const marker = '<!-- loey-github:' + pr.repository + '#' + pr.number + ' -->';
  for (const line of lines) {
    if (line.includes(marker)) return true;
    if (legacyMergeEvidence(line, pr, allowShortScope)) return true;
  }
  return false;
}

export function requireReceipt(output, command, root) {
  const line = String(output).split(/\r?\n/).find((item) => /(?:^|\s)RESULT /.test(item));
  if (!line || !line.includes('RESULT ' + command + ' ') ||
      !/RESULT \w+ (logged|already-recorded)\b/.test(line) ||
      !line.includes(' lock=flock ') || !line.includes(' target=' + root + ' source=LOEY_SPACE_DIR')) {
    throw new Error('Logger did not return a verified success receipt for the intended vault.');
  }
  return line;
}

export function reconcileMilestones({ config, state, pullRequests, through }, io) {
  const nextState = validateState(state);
  const cutoff = Date.parse(through);
  if (!Number.isFinite(cutoff)) throw new Error('Invalid scan boundary.');
  const candidates = new Map();
  for (const pr of pullRequests) {
    if (!config.repositories.includes(pr.repository)) throw new Error('PR belongs to an unconfigured repository.');
    const at = Date.parse(pr.mergedAt);
    if (at < Date.parse(config.startFrom) || at > cutoff) continue;
    if (candidates.has(pr.url) && candidates.get(pr.url).mergeSha !== pr.mergeSha) {
      throw new Error('Conflicting merge metadata for the same PR.');
    }
    candidates.set(pr.url, pr);
  }
  const ordered = [...candidates.values()].sort((a, b) => a.mergedAt.localeCompare(b.mergedAt) || a.url.localeCompare(b.url));
  let logged = 0;
  let alreadyRecorded = 0;
  for (const pr of ordered) {
    const receipt = nextState.receipts[pr.url];
    const uniqueSlug = config.repositories.filter((repo) => repo.split('/')[1] === pr.repository.split('/')[1]).length === 1;
    const inspect = () => io.inspect(pr, receipt, uniqueSlug);
    let proof = inspect();
    if (receipt && receipt.mergeSha !== pr.mergeSha) throw new Error('Stored receipt has a different merge SHA.');
    if (receipt && !proof.daily) throw new Error('Previously verified daily entry is absent; checkpoint preserved.');
    if (!proof.daily || !proof.handoff) {
      io.requireRecords();
      const command = !proof.daily && !proof.handoff ? 'done' : !proof.daily ? 'log' : 'handoff';
      requireReceipt(io.log(command, milestoneSummary(pr, config.timeZone)), command, io.root);
      proof = inspect();
      if (!proof.daily || !proof.handoff) throw new Error('Post-write verification failed for ' + pr.url + '.');
      logged++;
    } else {
      alreadyRecorded++;
    }
    nextState.receipts[pr.url] = {
      dailyPath: proof.dailyPath, mergedAt: pr.mergedAt, mergeSha: pr.mergeSha
    };
    io.saveState(nextState);
  }
  for (const repository of config.repositories) {
    const previous = nextState.scans[repository];
    if (!previous || Date.parse(previous) < cutoff) nextState.scans[repository] = through;
  }
  io.saveState(nextState);
  return { outcome: logged ? 'logged' : 'unchanged', logged, alreadyRecorded, state: nextState };
}
