# xmind: check_loyalty_status
# args: base_url, api_key, organization_id, studio_id, q

base = args.get("base_url", "").rstrip("/")
sid = str(args.get("studio_id", ""))
q = args.get("q", "")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/studios/" + sid + "/clients/loyalty"
r = requests.get(url, headers=headers, params={"q": q}, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
