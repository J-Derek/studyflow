import { describe, expect, it } from 'vitest';
import ICAL from 'ical.js';
import { escapeIcsText, foldLine, generateICalendarFeed, monthIcsOptions } from './icalExport';
import type { Assignment, StudySession } from '../types';

const lecture = (over: Partial<StudySession> = {}): StudySession => ({
  id: 's1', title: 'Algorithms', course: 'CS 301', dayOfWeek: 0, startTime: '09:00', endTime: '10:30', type: 'lecture', ...over
});

const NOW = new Date('2026-02-20T12:00:00Z');

function parse(ics: string) {
  const comp = new ICAL.Component(ICAL.parse(ics));
  return { comp, events: comp.getAllSubcomponents('vevent').map((e: ICAL.Component) => new ICAL.Event(e)) };
}

describe('text handling', () => {
  it('escapes backslash, semicolon, comma and newline', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
  it('folds at 75 octets and never splits a multi-byte character', () => {
    const line = 'SUMMARY:' + '😀'.repeat(40);
    const folded = foldLine(line);
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(folded.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });
});

describe('feed structure', () => {
  const ics = generateICalendarFeed([lecture()], {
    timeZone: 'Africa/Nairobi', semesterStart: '2026-03-01', semesterEnd: '2026-06-30', sequence: 3, now: NOW
  });
  it('uses CRLF line endings throughout and ends with one', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
  it('has no line longer than 75 octets', () => {
    for (const l of ics.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
  it('includes a VTIMEZONE for the TZID it uses', () => {
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:Africa/Nairobi');
    expect(ics).toContain('DTSTART;TZID=Africa/Nairobi:20260301T090000');
  });
  it('writes a UTC UNTIL, a stable UID and the given SEQUENCE', () => {
    expect(ics).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=SU;UNTIL=\d{8}T\d{6}Z/);
    expect(ics).toContain('UID:s1@studyflow.app');
    expect(ics).toContain('SEQUENCE:3');
    expect(generateICalendarFeed([lecture()], { timeZone: 'Africa/Nairobi', semesterStart: '2026-03-01', now: NOW, sequence: 4 })).toContain('SEQUENCE:4');
  });
  it('excludes sample sessions', () => {
    expect(generateICalendarFeed([lecture({ sample: true })], { now: NOW })).not.toContain('BEGIN:VEVENT');
  });
});

describe('round trip through a real parser (ical.js)', () => {
  it('survives hostile text: commas, semicolons, newline, backslash, emoji', () => {
    const title = 'Maths; Part 1, "Intro"\\ 😀 ' + 'long '.repeat(30);
    const { events } = parse(generateICalendarFeed([lecture({ title })], { timeZone: 'Africa/Nairobi', semesterStart: '2026-03-01', now: NOW }));
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe(`${title} (CS 301)`);
  });

  it('Africa/Nairobi (control): 09:00 local is 06:00 UTC every week', () => {
    const { events } = parse(generateICalendarFeed([lecture()], { timeZone: 'Africa/Nairobi', semesterStart: '2026-03-01', semesterEnd: '2026-04-30', now: NOW }));
    const it = events[0].iterator();
    const seen: string[] = [];
    for (let n = 0; n < 5; n++) seen.push(it.next().toJSDate().toISOString());
    expect(seen.every((s) => s.endsWith('T06:00:00.000Z'))).toBe(true);
    expect(seen[0]).toBe('2026-03-01T06:00:00.000Z');
  });

  it('America/New_York: a Sunday 09:00 class stays 09:00 local across the 2026-03-08 spring-forward', () => {
    const ics = generateICalendarFeed([lecture({ dayOfWeek: 0 })], { timeZone: 'America/New_York', semesterStart: '2026-03-01', semesterEnd: '2026-03-29', now: NOW });
    expect(ics).toContain('BEGIN:DAYLIGHT');
    const { events } = parse(ics);
    const it = events[0].iterator();
    const utc: string[] = [];
    for (let n = 0; n < 4; n++) utc.push(it.next().toJSDate().toISOString());
    // 2026-03-01 is EST (UTC-5) -> 14:00Z; from 2026-03-08 it is EDT (UTC-4) -> 13:00Z
    expect(utc).toEqual([
      '2026-03-01T14:00:00.000Z',
      '2026-03-08T13:00:00.000Z',
      '2026-03-15T13:00:00.000Z',
      '2026-03-22T13:00:00.000Z'
    ]);
  });

  it('America/New_York: stays 09:00 local across the 2026-11-01 fall-back', () => {
    const ics = generateICalendarFeed([lecture({ dayOfWeek: 0 })], { timeZone: 'America/New_York', semesterStart: '2026-10-25', semesterEnd: '2026-11-15', now: NOW });
    expect(ics).toContain('BEGIN:STANDARD');
    const { events } = parse(ics);
    const it = events[0].iterator();
    const utc: string[] = [];
    for (let n = 0; n < 4; n++) utc.push(it.next().toJSDate().toISOString());
    // 2026-10-25 is EDT -> 13:00Z; from 2026-11-01 EST -> 14:00Z
    expect(utc).toEqual([
      '2026-10-25T13:00:00.000Z',
      '2026-11-01T14:00:00.000Z',
      '2026-11-08T14:00:00.000Z',
      '2026-11-15T14:00:00.000Z'
    ]);
  });

  it('stops at the semester end (UNTIL is respected)', () => {
    const { events } = parse(generateICalendarFeed([lecture()], { timeZone: 'Africa/Nairobi', semesterStart: '2026-03-01', semesterEnd: '2026-03-15', now: NOW }));
    const it = events[0].iterator();
    let count = 0;
    while (it.next() && count < 20) count++;
    expect(count).toBe(3); // Mar 1, 8, 15
  });
});

const deadline = (over: Partial<Assignment> = {}): Assignment => ({
  id: 'a1', title: 'Essay', course: 'ENG 101', dueDate: '2026-03-10', priority: 'high', status: 'pending',
  progress: 0, createdAt: '2026-02-01T00:00:00.000Z', ...over
});

describe('deadline reminders', () => {
  const opts = { timeZone: 'Africa/Nairobi', semesterStart: '2026-03-01', semesterEnd: '2026-06-30', now: NOW };

  it('exports a timed deadline with a day-before and an hour-before alarm', () => {
    const ics = generateICalendarFeed([], { ...opts, assignments: [deadline({ dueTime: '14:00' })] });
    expect(ics).toContain('UID:a-a1@studyflow.app');
    expect(ics).toContain('DTSTART;TZID=Africa/Nairobi:20260310T140000');
    expect(ics).toContain('DTEND;TZID=Africa/Nairobi:20260310T143000');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('TRIGGER:-PT1H');
    const { events } = parse(ics);
    expect(events[0].summary).toBe('Due: Essay (ENG 101)');
  });
  it('exports an all-day deadline when there is no due time', () => {
    const ics = generateICalendarFeed([], { ...opts, assignments: [deadline()] });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260310');
    expect(ics).toContain('DTEND;VALUE=DATE:20260311');
    expect(ics).toContain('TRIGGER:-PT15H');
    expect(ics).toContain('TRIGGER:PT8H');
    expect(parse(ics).events).toHaveLength(1);
  });
  it('skips completed and sample assignments', () => {
    const ics = generateICalendarFeed([], { ...opts, assignments: [deadline({ status: 'completed' }), deadline({ id: 'a2', sample: true })] });
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
  it('covers a deadline outside the semester with a timezone and keeps lines short', () => {
    const ics = generateICalendarFeed([], { ...opts, assignments: [deadline({ dueDate: '2026-09-01', dueTime: '09:00' })] });
    expect(ics).toContain('BEGIN:VTIMEZONE');
    for (const l of ics.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(parse(ics).events).toHaveLength(1);
  });
});

describe('one month for the calendar', () => {
  const NOVEMBER = { timeZone: 'Africa/Nairobi', now: NOW, assignments: [
    deadline({ id: 'in', dueDate: '2026-11-18', title: 'Inside' }),
    deadline({ id: 'before', dueDate: '2026-10-30', title: 'Before' }),
    deadline({ id: 'after', dueDate: '2026-12-02', title: 'After' }),
    deadline({ id: 'done', dueDate: '2026-11-10', title: 'Done', status: 'completed' })
  ] };
  it('keeps only the deadlines due in that month, runs classes between its first and last day, and names the file after the month', () => {
    const opts = monthIcsOptions(2026, 11, NOVEMBER);
    expect(opts.semesterStart).toBe('2026-11-01');
    expect(opts.semesterEnd).toBe('2026-11-30');
    expect(opts.fileName).toBe('StudyFlow_2026-11.ics');
    expect(opts.assignments?.map((a) => a.id).sort()).toEqual(['done', 'in']);
    const ics = generateICalendarFeed([lecture()], opts);
    expect(ics).toContain('SUMMARY:Due: Inside (ENG 101)');
    expect(ics).not.toContain('Before');
    expect(ics).not.toContain('After');
    expect(ics).not.toContain('Done'); // finished work is never exported
    const { events } = parse(ics);
    const it = events.find((e) => e.isRecurring())!.iterator();
    const dates: string[] = [];
    for (let t = it.next(); t && dates.length < 20; t = it.next()) dates.push(t.toString().slice(0, 10));
    expect(dates.every((d) => d >= '2026-11-01' && d <= '2026-11-30')).toBe(true);
    expect(dates.length).toBeGreaterThanOrEqual(4);
  });
});
