export function aucklandStamp(date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (name: string): string => parts.find(value => value.type === name)!.value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

function minuteOfDay(value: string): number | null {
  const match = value.replace(/&nbsp;|\u00a0/g, ' ').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + minute;
}

export function displayLogTime(value: string, separator = ' '): string {
  const minutes = minuteOfDay(value);
  if (minutes === null) return value;
  const hour = Math.floor(minutes / 60);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}${separator}${hour >= 12 ? 'PM' : 'AM'}`;
}

export function normalizeDailyLog(content: string): string {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(newline);
  const start = lines.findIndex(line => /^## 📝 Daily Log\s*$/.test(line));
  if (start < 0) return content;
  let end = start + 1;
  while (end < lines.length && !/^#{1,6}\s|^---\s*$/.test(lines[end])) end++;
  let fenced = false;
  for (let i = start + 1; i < end;) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; i++; continue; }
    if (fenced) { i++; continue; }
    const bullet = (line: string): RegExpMatchArray | null => line.match(/^(- \*\*\[?)([^\]*]+)(\]?\*\*(?::|\s).*)$/);
    const table = (line: string): RegExpMatchArray | null => line.match(/^(> \|\s*)([^|]+?)(\s*\|.*)$/);
    const kind = bullet(lines[i]) ? bullet : table;
    const first = kind(lines[i]);
    if (!first || minuteOfDay(first[2]) === null) { i++; continue; }
    const entries: { minutes: number; lines: string[] }[] = [];
    let cursor = i;
    while (cursor < end) {
      const match = kind(lines[cursor]);
      const minutes = match ? minuteOfDay(match[2]) : null;
      if (!match || minutes === null) break;
      const entry = [match[1] + displayLogTime(match[2], kind === table ? '&nbsp;' : ' ') + match[3]];
      cursor++;
      if (kind === bullet) {
        while (cursor < end && /^(?: {2,}|\t)\S/.test(lines[cursor])) entry.push(lines[cursor++]);
      }
      entries.push({ minutes, lines: entry });
    }
    const sorted = entries.sort((a, b) => a.minutes - b.minutes).flatMap(entry => entry.lines);
    lines.splice(i, cursor - i, ...sorted);
    i = cursor;
  }
  return lines.join(newline);
}
