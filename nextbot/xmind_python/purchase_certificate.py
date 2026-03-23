# xmind: purchase_certificate (заглушка 501)
# Без import json — json.loads / requests(..., json=...)

base = args.get("base_url", "").rstrip("/")
headers = {
  "X-API-Key": args.get("api_key", ""),
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
