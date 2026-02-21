import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDateForAppleScript, parseDateComponents } from './dateFormatter.js';

test('parseDateComponents extracts year/month/day from date-only input', () => {
  assert.deepEqual(parseDateComponents('2026-12-31'), { year: 2026, month: 12, day: 31 });
});

test('parseDateComponents extracts date and time from full ISO input', () => {
  assert.deepEqual(parseDateComponents('2026-01-09T23:59:00'), { year: 2026, month: 1, day: 9, hours: 23, minutes: 59, seconds: 0 });
});

test('parseDateComponents extracts date and time without seconds', () => {
  assert.deepEqual(parseDateComponents('2026-03-03T09:30'), { year: 2026, month: 3, day: 3, hours: 9, minutes: 30, seconds: 0 });
});

test('parseDateComponents throws on invalid input', () => {
  assert.throws(() => parseDateComponents('not-a-date'));
});

test('formatDateForAppleScript returns makeDate with zeros for date-only input', () => {
  assert.equal(formatDateForAppleScript('2026-03-03'), 'my makeDate(2026, 3, 3, 0, 0, 0)');
});

test('formatDateForAppleScript preserves time when provided', () => {
  assert.equal(formatDateForAppleScript('2026-01-09T14:30:00'), 'my makeDate(2026, 1, 9, 14, 30, 0)');
});

test('formatDateForAppleScript throws on invalid input', () => {
  assert.throws(() => formatDateForAppleScript('not-a-date'));
});
