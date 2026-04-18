# xmind: get_active_promotions
# HTTP: GET {base_url}/nextbot/studios/{studioId}/landing/promotions
# Args: base_url, api_key, organization_id, studio_id
# Ответ: { "data": [ акции... ], "get_active_promotions": "<промпт>" }

base = args.get("base_url", "").rstrip("/")
sid = str(args.get("studio_id", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/studios/" + sid + "/landing/promotions"
r = requests.get(url, headers=headers, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
