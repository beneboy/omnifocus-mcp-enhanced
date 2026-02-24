import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveDisplayStatus,
  formatEstimate,
  formatDisplayDate,
  formatTask,
  groupTasksByProject,
  type TaskData,
} from './formatTask.js';

// ── resolveDisplayStatus ────────────────────────────────────────────

test('resolveDisplayStatus: Blocked + future defer → Deferred', () => {
  assert.equal(resolveDisplayStatus('Blocked', '2099-01-01T00:00:00.000Z'), 'Deferred');
});

test('resolveDisplayStatus: Blocked + past defer → Blocked', () => {
  assert.equal(resolveDisplayStatus('Blocked', '2020-01-01T00:00:00.000Z'), 'Blocked');
});

test('resolveDisplayStatus: Blocked + no defer → Blocked', () => {
  assert.equal(resolveDisplayStatus('Blocked', null), 'Blocked');
  assert.equal(resolveDisplayStatus('Blocked', undefined), 'Blocked');
});

test('resolveDisplayStatus: non-Blocked statuses pass through', () => {
  assert.equal(resolveDisplayStatus('Available', '2099-01-01T00:00:00.000Z'), 'Available');
  assert.equal(resolveDisplayStatus('Next', null), 'Next');
  assert.equal(resolveDisplayStatus('DueSoon', null), 'DueSoon');
  assert.equal(resolveDisplayStatus('Overdue', null), 'Overdue');
});

test('resolveDisplayStatus: empty/undefined status → empty string', () => {
  assert.equal(resolveDisplayStatus(undefined, null), '');
  assert.equal(resolveDisplayStatus('', null), '');
});

// ── formatEstimate ──────────────────────────────────────────────────

test('formatEstimate: 0 minutes', () => {
  assert.equal(formatEstimate(0), '0m');
});

test('formatEstimate: minutes only', () => {
  assert.equal(formatEstimate(30), '30m');
  assert.equal(formatEstimate(45), '45m');
});

test('formatEstimate: exact hours', () => {
  assert.equal(formatEstimate(60), '1h');
  assert.equal(formatEstimate(120), '2h');
});

test('formatEstimate: hours + minutes', () => {
  assert.equal(formatEstimate(90), '1h30m');
  assert.equal(formatEstimate(150), '2h30m');
  assert.equal(formatEstimate(61), '1h1m');
});

// ── formatDisplayDate ───────────────────────────────────────────────

test('formatDisplayDate: compact mode returns M/D', () => {
  // Construct a local-noon date to avoid timezone day-shift issues
  const d = new Date(2026, 5, 15, 12, 0, 0); // June 15 local
  const result = formatDisplayDate(d.toISOString(), true);
  assert.equal(result, '6/15');
});

test('formatDisplayDate: full mode returns locale string', () => {
  const d = new Date(2026, 5, 15, 12, 0, 0);
  const result = formatDisplayDate(d.toISOString(), false);
  // Should contain the year at minimum
  assert.match(result, /2026/);
});

test('formatDisplayDate: invalid date returns input', () => {
  assert.equal(formatDisplayDate('not-a-date'), 'not-a-date');
});

// ── formatTask: standard mode ───────────────────────────────────────

test('formatTask: minimal task (name only)', () => {
  const result = formatTask({ name: 'Buy milk' });
  assert.equal(result, '- Buy milk\n');
});

test('formatTask: flagged task', () => {
  const result = formatTask({ name: 'Buy milk', flagged: true });
  assert.equal(result, '- [flagged] Buy milk\n');
});

test('formatTask: all date fields', () => {
  const task: TaskData = {
    name: 'Task',
    dueDate: '2099-06-15T12:00:00.000Z',
    deferDate: '2099-06-10T12:00:00.000Z',
    plannedDate: '2099-06-12T12:00:00.000Z',
  };
  const result = formatTask(task);
  assert.match(result, /DUE:/);
  assert.match(result, /DEFER:/);
  assert.match(result, /PLAN:/);
  // All in one bracket
  assert.match(result, /\[DUE:.*,\s*DEFER:.*,\s*PLAN:/);
});

test('formatTask: overdue detection', () => {
  const task: TaskData = {
    name: 'Overdue task',
    dueDate: '2020-01-01T12:00:00.000Z',
  };
  const result = formatTask(task);
  assert.match(result, /OVERDUE:/);
  assert.doesNotMatch(result, /\bDUE:/);
});

test('formatTask: status and estimate in parens', () => {
  const task: TaskData = {
    name: 'Task',
    taskStatus: 'Next',
    estimatedMinutes: 90,
  };
  const result = formatTask(task);
  assert.match(result, /\(Next, 1h30m\)/);
});

test('formatTask: Available status hidden', () => {
  const task: TaskData = {
    name: 'Task',
    taskStatus: 'Available',
    estimatedMinutes: 30,
  };
  const result = formatTask(task);
  // Should show estimate but not status
  assert.match(result, /\(30m\)/);
  assert.doesNotMatch(result, /Available/);
});

test('formatTask: Blocked + future defer shows Deferred', () => {
  const task: TaskData = {
    name: 'Deferred task',
    taskStatus: 'Blocked',
    deferDate: '2099-03-01T12:00:00.000Z',
  };
  const result = formatTask(task);
  assert.match(result, /\(Deferred\)/);
  assert.doesNotMatch(result, /Blocked/);
});

test('formatTask: note and tags', () => {
  const task: TaskData = {
    name: 'Task',
    note: 'Remember this',
    tags: [{ name: 'errands' }, { name: 'shopping' }],
  };
  const result = formatTask(task);
  assert.match(result, /\n  Note: Remember this\n/);
  assert.match(result, /\n  Tags: errands, shopping\n/);
});

test('formatTask: string tags handled', () => {
  const task: TaskData = {
    name: 'Task',
    tags: ['errands', 'shopping'],
  };
  const result = formatTask(task);
  assert.match(result, /Tags: errands, shopping/);
});

test('formatTask: showNote=false suppresses note', () => {
  const task: TaskData = { name: 'Task', note: 'secret' };
  const result = formatTask(task, { showNote: false });
  assert.doesNotMatch(result, /Note:/);
});

test('formatTask: showTags=false suppresses tags', () => {
  const task: TaskData = { name: 'Task', tags: [{ name: 'a' }] };
  const result = formatTask(task, { showTags: false });
  assert.doesNotMatch(result, /Tags:/);
});

test('formatTask: custom bullet', () => {
  const result = formatTask({ name: 'Task' }, { bullet: '1. ' });
  assert.match(result, /^1\. Task\n$/);
});

test('formatTask: showProject', () => {
  const task: TaskData = { name: 'Task', projectName: 'My Project' };
  const result = formatTask(task, { showProject: true });
  assert.match(result, /Task \(My Project\)/);
});

test('formatTask: showProject with inbox', () => {
  const task: TaskData = { name: 'Task', inInbox: true };
  const result = formatTask(task, { showProject: true });
  assert.match(result, /Task \(Inbox\)/);
});

test('formatTask: typeIndicator', () => {
  const task: TaskData = { name: 'Task' };
  const result = formatTask(task, { typeIndicator: 'due' });
  assert.match(result, /\[due\]/);
});

test('formatTask: showCompletionTime', () => {
  const task: TaskData = {
    name: 'Done task',
    completedDate: '2026-06-15T14:30:00.000Z',
  };
  const result = formatTask(task, { showCompletionTime: true });
  assert.match(result, /\*\(completed .+\)\*/);
  // Should NOT show DONE: date when showCompletionTime is true
  assert.doesNotMatch(result, /DONE:/);
});

test('formatTask: highlightTags bolds matched tags', () => {
  const task: TaskData = {
    name: 'Task',
    tags: [{ name: 'errands' }, { name: 'shopping' }],
  };
  const result = formatTask(task, { highlightTags: ['errands'] });
  assert.match(result, /\*\*errands\*\*/);
  assert.doesNotMatch(result, /\*\*shopping\*\*/);
});

test('formatTask: completedDate shown as DONE when not showCompletionTime', () => {
  const task: TaskData = {
    name: 'Task',
    completedDate: '2026-06-15T14:30:00.000Z',
  };
  const result = formatTask(task);
  assert.match(result, /DONE:/);
});

// ── formatTask: compact mode ────────────────────────────────────────

test('formatTask compact: basic format', () => {
  // Use local-noon dates to avoid timezone day-shift
  const due = new Date(2026, 2, 1, 12, 0, 0);    // Mar 1
  const defer = new Date(2099, 1, 25, 12, 0, 0);  // Feb 25 (future)
  const planned = new Date(2026, 1, 28, 12, 0, 0); // Feb 28

  const task: TaskData = {
    name: 'Buy groceries',
    flagged: true,
    dueDate: due.toISOString(),
    deferDate: defer.toISOString(),
    plannedDate: planned.toISOString(),
    taskStatus: 'Blocked',
    estimatedMinutes: 90,
    tags: [{ name: 'errands' }, { name: 'shopping' }],
  };
  const result = formatTask(task, { compact: true, bullet: '• ' });

  assert.match(result, /^• \[flagged\] Buy groceries/);
  assert.match(result, /\[DUE:3\/1\]/);
  assert.match(result, /\[defer:2\/25\]/);
  assert.match(result, /\[PLAN:2\/28\]/);
  assert.match(result, /\(1h30m\)/);
  assert.match(result, /<errands,shopping>/);
  assert.match(result, /#defer/);
  // Should NOT have detail lines
  assert.doesNotMatch(result, /Note:/);
  assert.doesNotMatch(result, /Tags:/);
});

test('formatTask compact: Available status shown as #avail', () => {
  const task: TaskData = { name: 'Task', taskStatus: 'Available' };
  const result = formatTask(task, { compact: true });
  assert.match(result, /#avail/);
});

test('formatTask compact: no fields', () => {
  const result = formatTask({ name: 'Simple' }, { compact: true });
  assert.equal(result, '- Simple\n');
});

// ── groupTasksByProject ─────────────────────────────────────────────

test('groupTasksByProject: groups by projectName', () => {
  const tasks: TaskData[] = [
    { name: 'A', projectName: 'Proj1' },
    { name: 'B', projectName: 'Proj2' },
    { name: 'C', projectName: 'Proj1' },
  ];
  const grouped = groupTasksByProject(tasks);
  assert.equal(grouped.size, 2);
  assert.equal(grouped.get('Proj1')!.length, 2);
  assert.equal(grouped.get('Proj2')!.length, 1);
});

test('groupTasksByProject: inbox tasks', () => {
  const tasks: TaskData[] = [
    { name: 'A', inInbox: true },
  ];
  const grouped = groupTasksByProject(tasks);
  assert.ok(grouped.has('Inbox'));
});

test('groupTasksByProject: no project → "No Project"', () => {
  const tasks: TaskData[] = [
    { name: 'A' },
  ];
  const grouped = groupTasksByProject(tasks);
  assert.ok(grouped.has('No Project'));
});

test('groupTasksByProject: preserves insertion order', () => {
  const tasks: TaskData[] = [
    { name: 'A', projectName: 'Beta' },
    { name: 'B', projectName: 'Alpha' },
    { name: 'C', projectName: 'Beta' },
  ];
  const grouped = groupTasksByProject(tasks);
  const keys = [...grouped.keys()];
  assert.deepEqual(keys, ['Beta', 'Alpha']);
});
