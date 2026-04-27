import {
  shouldUseClientsPagedResponse,
  parseClientsSort,
  parseClientListSegment,
  parsePageLimit,
  parseNonNegativeInt,
  escapeIlikeUserInput,
  onlyDigits,
} from './client-list-paginate.util';
import { ClientListSegment } from './client-list-paginate.types';

describe('client-list-paginate.util', () => {
  it('shouldUseClientsPagedResponse: any of limit, offset, q, sort, segment enables paged mode', () => {
    expect(shouldUseClientsPagedResponse({})).toBe(false);
    expect(shouldUseClientsPagedResponse({ limitStr: '20' })).toBe(true);
    expect(shouldUseClientsPagedResponse({ offsetStr: '0' })).toBe(true);
    expect(shouldUseClientsPagedResponse({ q: ' ann ' })).toBe(true);
    expect(shouldUseClientsPagedResponse({ sortStr: 'firstName:asc' })).toBe(true);
    expect(shouldUseClientsPagedResponse({ segmentStr: ' VIP ' })).toBe(true);
  });

  it('parseClientsSort: defaults and invalid → lastVisitAt:desc', () => {
    expect(parseClientsSort(undefined, 'lastVisitAt:desc')).toBe('lastVisitAt:desc');
    expect(parseClientsSort('  ', 'lastVisitAt:desc')).toBe('lastVisitAt:desc');
    expect(parseClientsSort('nope', 'lastVisitAt:desc')).toBe('lastVisitAt:desc');
    expect(parseClientsSort('firstName:asc', 'lastVisitAt:desc')).toBe('firstName:asc');
  });

  it('parseClientListSegment: maps enum', () => {
    expect(parseClientListSegment('vip')).toBe(ClientListSegment.VIP);
    expect(parseClientListSegment(undefined)).toBe(null);
    expect(parseClientListSegment('nope')).toBe(null);
  });

  it('parsePageLimit: clamps 1..100', () => {
    expect(parsePageLimit(undefined, 20)).toBe(20);
    expect(parsePageLimit('0', 20)).toBe(20);
    expect(parsePageLimit('1', 20)).toBe(1);
    expect(parsePageLimit('200', 20, 1, 100)).toBe(100);
  });

  it('parseNonNegativeInt', () => {
    expect(parseNonNegativeInt(undefined, 0)).toBe(0);
    expect(parseNonNegativeInt('10', 0)).toBe(10);
  });

  it('escapeIlikeUserInput: escapes % and _', () => {
    expect(escapeIlikeUserInput('a%b_c')).toBe('a\\%b\\_c');
  });

  it('onlyDigits: strips to digits', () => {
    expect(onlyDigits('+7 (701) 123-45-67')).toBe('77011234567');
  });
});
