import { describe, expect, it } from 'vitest';
import ICAL from 'ical.js';
import { escapeIcsText, foldLine, generateICalendarFeed } from './icalExport';
import type { StudySession } from '../types';

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
