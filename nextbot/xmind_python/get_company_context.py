# xmind: get_company_context
# args: base_url, api_key

base = args.get("base_url", "").rstrip("/")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/context"
r = requests.get(url, headers=headers, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
