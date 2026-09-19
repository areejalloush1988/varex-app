import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('task form reference is captured before the asynchronous save', () => {
  const saveTask = client.slice(client.indexOf('async function saveTask'), client.indexOf('async function addLead'));
  assert.match(saveTask, /const form = event\.currentTarget;/);
  assert.match(saveTask, /form\.reset\(\);/);
  assert.doesNotMatch(saveTask, /event\.currentTarget\.reset\(\)/);
});

test('successful agent and task saves are not reported as failures when audit logging fails', () => {
  const saveAgent = client.slice(client.indexOf('async function saveAgent'), client.indexOf('function refreshTaskAgentOptions'));
  const saveTask = client.slice(client.indexOf('async function saveTask'), client.indexOf('async function addLead'));
  assert.match(saveAgent, /catch \(auditError\)/);
  assert.match(saveTask, /catch \(auditError\)/);
});
