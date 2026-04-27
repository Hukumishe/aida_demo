import { ClientListSegment, SortKey } from './client-list-paginate.types';

export function escapeIlikeUserInput(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

export function onlyDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Триггер нового ответа { items, total, limit, offset } (п. обратной совместимости). */
export function shouldUseClientsPagedResponse(
  input: { limitStr?: string; offsetStr?: string; q?: string; sortStr?: string; segmentStr?: string },
): boolean {
  return (
    (input.limitStr != null && input.limitStr !== '') ||
    (input.offsetStr != null && input.offsetStr !== '') ||
    (input.q != null && String(input.q).trim() !== '') ||
    (input.sortStr != null && String(input.sortStr).trim() !== '') ||
    (input.segmentStr != null && String(input.segmentStr).trim() !== '')
  );
}

const SORTS: Set<string> = new Set(['lastVisitAt:desc', 'createdAt:desc', 'firstName:asc']);

export function parseClientsSort(
  sortStr: string | undefined,
  defaultKey: string = 'lastVisitAt:desc',
): string {
  const t = (sortStr ?? defaultKey).trim();
  if (SORTS.has(t)) return t;
  return defaultKey;
}

const SEGMENTS: Set<string> = new Set(Object.values(ClientListSegment) as string[]);

export function parseClientListSegment(
  s: string | undefined,
): string | null {
  if (s == null || String(s).trim() === '') return null;
  const u = String(s).toUpperCase().trim();
  if (SEGMENTS.has(u)) return u;
  return null;
}

export function parseNonNegativeInt(s: string | undefined, d: number, max?: number): number {
  if (s == null || s === '') return d;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return d;
  if (max != null) return Math.min(n, max);
  return n;
}

export function parsePageLimit(s: string | undefined, d = 20, min = 1, max = 100): number {
  if (s == null || s === '') return d;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return d;
  return Math.min(max, Math.max(min, n));
}

export const CLIENT_LIST_DEFAULT_SORT: SortKey = 'lastVisitAt:desc';
