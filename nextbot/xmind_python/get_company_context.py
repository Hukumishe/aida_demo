# xmind: get_company_context
# HTTP: GET {base_url}/nextbot/context
# Args: base_url, api_key, organization_id  (для API-ключа обязателен X-Organization-Id)
# Ответ JSON: organizationId, studios[], плюс строка промпта с портала в поле "get_company_context".

base = args.get("base_url", "").rstrip("/")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/context"
r = requests.get(url, headers=headers, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
