# xmind: get_active_promotions
# args: base_url, api_key, studio_id

base = args.get("base_url", "").rstrip("/")
sid = str(args.get("studio_id", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/studios/" + sid + "/landing/promotions"
r = requests.get(url, headers=headers, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
