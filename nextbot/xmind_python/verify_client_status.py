# xmind: verify_client_status
# HTTP: GET {base_url}/nextbot/clients/verify?q=...
# Args: base_url, api_key, organization_id [, q]
# Ответ: found, client, плюс промпт в поле "verify_client_status".

base = args.get("base_url", "").rstrip("/")
q = args.get("q", "")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/clients/verify"
r = requests.get(url, headers=headers, params={"q": q}, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
