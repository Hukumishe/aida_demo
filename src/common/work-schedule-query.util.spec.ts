import {
  addDaysToDateString,
  parseWorkScheduleDateInput,
  workScheduleDateToYmd,
} from './work-schedule-query.util';

describe('work-schedule-query.util', () => {
  it('parses YYYY-MM-DD as UTC midnight', () => {
    const d = parseWorkScheduleDateInput('2026-06-24');
    expect(d.toISOString()).toBe('2026-06-24T00:00:00.000Z');
  });

  it('adds days to date string', () => {
    expect(addDaysToDateString('2026-06-24', 7)).toBe('2026-07-01');
  });

  it('formats schedule date to YMD', () => {
    expect(workScheduleDateToYmd(new Date('2026-06-24T00:00:00.000Z'))).toBe(
      '2026-06-24',
    );
  });
});
