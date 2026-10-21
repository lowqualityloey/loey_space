import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {insertAgentMilestone,normalizeDailyLog,migrateAgentMilestones} from '../src/lib/daily-log-time.ts';
import {canonicalCli,makeVault,writeDaily,runCli,areaOf,AGENT_AREA,DAILY_HEADING,PERSONAL_AREA,GITHUB_AREA,claimedCount,rowsOf} from './helpers/canonical-fixture.mjs';
const empty=[DAILY_HEADING,'',PERSONAL_AREA,'',AGENT_AREA,'','> [!NOTE]- 🤖 Show entries (0)','> | Time | Scope | Milestone |','> | :--- | :--- | :--- |','',GITHUB_AREA,'','---',''].join('\n');
function assertTable(content){
  const quoted=areaOf(content,AGENT_AREA).split('\n').filter(line=>line.startsWith('>'));
  assert.equal(quoted[0],'> [!NOTE]- 🤖 Show entries (1)');
  assert.equal(quoted[1],'> | Time | Scope | Milestone |');
  assert.equal(quoted[2],'> | :--- | :--- | :--- |');
  assert.match(quoted[3],/^> \| \d{2}:\d{2}&nbsp;[AP]M \| .* \| empty-table canary \|$/);
  assert.equal(quoted.length,4);
}
test('source appends after the separator when the container is empty',()=>{
  const result=insertAgentMilestone(empty,{stamp:'09:05 AM',summary:'empty-table canary'});
  assert.equal(result.ok,true);assertTable(result.content);
});
for(const [name,select] of [['repository bundle',()=>fileURLToPath(new URL('../heyloey.js',import.meta.url))],['canonical fixture',t=>canonicalCli(t)],...(process.env.HEYLOEY_EXPECT_INSTALLED_UPDATED==='1'?[['installed writer',()=>process.env.HEYLOEY_INSTALLED]]:[])]){
  test(name+' fills an empty container and repeats without changing bytes',t=>{
    const root=makeVault(t),file=writeDaily(root,empty),cli=select(t);
    const result=runCli(root,cli,['done','empty-table canary']);assert.equal(result.status,0,result.stderr);
    const first=fs.readFileSync(file,'utf8');assertTable(first);
    const repeat=runCli(root,cli,['done','empty-table canary']);assert.equal(repeat.status,0,repeat.stderr);
    assert.match(repeat.stdout,/RESULT done already-recorded/);assert.equal(fs.readFileSync(file,'utf8'),first);
    assert.equal(claimedCount(first),rowsOf(first).length);
  });
}

for(const placement of ['before-header','before-separator']){
  test('normalization repairs '+placement+' without losing entries or repeating changes',()=>{
    const row='> | 09:05&nbsp;AM | example | preserved milestone |';
    const malformed=empty.replace(placement==='before-header'?'> | Time':'> | :---',row+'\n'+(placement==='before-header'?'> | Time':'> | :---'));
    const repaired=normalizeDailyLog(malformed);
    const lines=areaOf(repaired,AGENT_AREA).split('\n').filter(line=>line.startsWith('>'));
    assert.deepEqual(lines,['> [!NOTE]- 🤖 Show entries (1)','> | Time | Scope | Milestone |','> | :--- | :--- | :--- |',row]);
    assert.equal(normalizeDailyLog(repaired),repaired);
    assert.deepEqual(rowsOf(repaired),rowsOf(malformed));
    assert.equal(migrateAgentMilestones(malformed).content,repaired);
  });
}
