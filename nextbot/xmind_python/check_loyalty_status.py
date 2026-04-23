# xmind: check_loyalty_status
# HTTP: GET {base_url}/nextbot/clients/loyalty?phone=...
# Args: base_url, api_key, organization_id [, phone]
# Ответ: уровень/бонусы и поле "check_loyalty_status" (промпт).

base = args.get("base_url", "").rstrip("/")
phone = args.get("phone", "")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/clients/loyalty"
r = requests.get(url, headers=headers, params={"phone": phone}, timeout=(2.5, 5))
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
