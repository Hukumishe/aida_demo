# xmind: purchase_certificate (backend 501 NOT_IMPLEMENTED)
# HTTP: POST {base_url}/nextbot/purchase-certificate
# Args: base_url, api_key, organization_id [, body_json]

base = args.get("base_url", "").rstrip("/")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
  "Content-Type": "application/json",
}
bj = args.get("body_json", None)
body = json.loads(bj) if bj else {}
url = base + "/nextbot/purchase-certificate"
r = requests.post(url, headers=headers, json=body, timeout=15)
try:
  data = r.json() if r.content else {}
except Exception:
  data = {"raw": r.text}
result = {"ok": r.ok, "status": r.status_code, "data": data}
