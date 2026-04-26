/**
 * Собирает список id услуг из query Nextbot: «serviceIds», «service_id» c повторами, CSV, legacy «serviceId».
 */
export function collectServiceIdList(
  serviceIds: string | string[] | undefined,
  serviceIdsSnake: string | string[] | undefined,
  serviceId: string | undefined,
  serviceIdSnake: string | undefined,
): string[] {
  const fromParams: string[] = [];
  const add = (v: string | string[] | undefined) => {
    if (v == null) return;
    for (const x of Array.isArray(v) ? v : [v]) {
      for (const seg of String(x).split(',')) {
        const t = seg.trim();
        if (t) {
          fromParams.push(t);
        }
      }
    }
  };
  add(serviceIds);
  add(serviceIdsSnake);
  if (fromParams.length) {
    const seen = new Set<string>();
    return fromParams.filter((id) => (seen.has(id) ? false : !!seen.add(id)));
  }
  const single = [serviceId, serviceIdSnake]
    .map((s) => (s != null && s !== '' ? String(s).trim() : ''))
    .find((s) => s !== '');
  return single ? [single] : [];
}
