# xmind: get_active_promotions
# HTTP: GET {base_url}/nextbot/studios/{studioId}/landing/promotions
# Args: base_url, api_key, organization_id, studio_id (опционально — если не передан, возьмём из /nextbot/context)
# Ответ: { "data": [ акции... ], "get_active_promotions": "<промпт>" }

base = args.get("base_url", "").rstrip("/")
sid = str(args.get("studio_id", "") or "").strip()
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}

result = None

# Если studio_id не передан — попробуем достать его из контекста организации.
if not sid:
  try:
    ctx = requests.get(base + "/nextbot/context", headers=headers, timeout=15)
    ctx_json = ctx.json() if ctx.ok else None
    studios = (ctx_json or {}).get("studios") or []
    if len(studios) == 1:
      sid = str(studios[0].get("id", "") or "").strip()
    elif len(studios) > 1:
      result = {
        "ok": False,
        "status": 400,
        "error": "studio_id_required",
        "data": "Не указан studio_id, а у организации несколько филиалов. Выберите один из studios[].id и вызовите функцию снова.",
        "studios": [{"id": s.get("id"), "name": s.get("name")} for s in studios],
      }
    else:
      result = {
        "ok": False,
        "status": 404,
        "error": "no_studios",
        "data": "У организации нет активных филиалов (studios[] пуст).",
      }
  except Exception as e:
    result = {
      "ok": False,
      "status": 0,
      "error": "context_fetch_failed",
      "data": "Не удалось получить /nextbot/context: " + str(e),
    }

if result is None:
  url = base + "/nextbot/studios/" + sid + "/landing/promotions"
  r = requests.get(url, headers=headers, timeout=15)
  try:
    data = r.json() if r.ok else r.text
  except Exception:
    data = r.text
  result = {"ok": r.ok, "status": r.status_code, "data": data, "studio_id": sid}
