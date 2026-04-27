export enum ClientListSegment {
  NEW = 'NEW',
  REGULAR = 'REGULAR',
  VIP = 'VIP',
  LOST = 'LOST',
}

export type SortKey = 'lastVisitAt:desc' | 'createdAt:desc' | 'firstName:asc';

export type ClientListQueryParams = {
  limit: number;
  offset: number;
  q: string;
  sort: string;
  segment: string | null;
};

export type ClientsPaginatedResponse = {
  items: unknown[];
  total: number;
  limit: number;
  offset: number;
};
