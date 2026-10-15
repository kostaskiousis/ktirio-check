import test from 'node:test';
import assert from 'node:assert/strict';
import { checksForMode } from '../src/catalog.mjs';
import { createCase, itemState, getSummary, filterChecks, exportBundle, importBundle, sanitizeCase, escapeHtml, loadStore } from '../src/engine.mjs';

test('separate buy and rent checklists', () => {
  const buy = checksForMode('buy');
  const rent = checksForMode('rent');
  assert.ok(buy.length >= 15 && rent.length >= 10);
  assert.ok(buy.some(c => c.id === 'title-deed'));
  assert.ok(!rent.some(c => c.id === 'title-deed'));
  assert.ok(rent.some(c => c.id === 'lease-tax'));
});

test('summary distinguishes user-reported completion and open flags', () => {
  const p = createCase('Test', '', 'buy');
  const start = getSummary(p);
  assert.equal(start.percent, 0);
  p.items['title-deed'] = {status:'checked'};
  p.items.encumbrances = {status:'issue'};
  p.items.energy = {status:'na', documentReceived:true};
  const result = getSummary(p);
  assert.equal(result.resolved, 2);
  assert.equal(result.concerns.length, 1);
  assert.equal(result.hasCriticalIssues, true);
  assert.equal(result.outstanding, result.total - 2);
  assert.equal(result.docsReceived, 1);
  assert.ok(result.docsTotal > 0);
});

test('search and filter', () => {
  const p = createCase('Test', '', 'rent');
  p.items.energy = { status:'requested'};
  assert.equal(filterChecks(p, { query:'Ενεργειακής' }).length, 1);
  assert.deepEqual(filterChecks(p, { status:'requested' }).map(c=>c.id), ['energy']);
  assert.ok(filterChecks(p, { category:'terms' }).length > 0);
});

test('JSON exports roundtrip but reset imported identity / demo marker', () => {
  const p = createCase('Δοκιμή', 'Αθήνα', 'rent', true);
  p.items.energy = {status:'checked', note:'ΟΚ', documentReceived:true};
  const clone = importBundle(exportBundle(p));
  assert.notEqual(clone.id, p.id);
  assert.equal(clone.demo, false);
  assert.equal(clone.items.energy.note, 'ΟΚ');
  assert.equal(clone.items.energy.documentReceived, true);
  assert.equal(clone.mode, 'rent');
});

test('malformed and malicious inputs are bounded and do not inject HTML', () => {
  assert.throws(() => importBundle('{broken'));
  assert.throws(() => importBundle('{"app":"Other","schema":1,"property":{}}'));
  const p = sanitizeCase({name:'<img src=x>', area:'Athens', mode:'buy', demo:true, items: {
    '__proto__': {status:'checked'}, 'title-deed': {status:'dangerous', note:'x'.repeat(5000)}, 'lease-tax': {status:'checked'}
  }});
  assert.equal(p.demo, false);
  assert.equal(itemState(p, 'title-deed').status, 'todo');
  assert.ok((p.items['title-deed']?.note || '').length <= 1200);
  assert.equal(p.items['lease-tax'], undefined);
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
});

test('local state corruption is handled with demo fallback', () => {
  const store = loadStore('bad-json');
  assert.equal(store.cases.length, 1);
  assert.equal(store.cases[0].demo, true);
});
