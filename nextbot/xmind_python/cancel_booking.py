# Удобная обёртка xmind: отмена записи (тот же API, что modify_booking)
# args: base_url, api_key, appointment_id
# Без import json — requests(..., json=...)

base = args.get("base_url", "").rstrip("/")
aid = str(args.get("appointment_id", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "Accept": "application/json",
  "Content-Type": "application/json",
}
body = {"status": "CANCELLED"}
url = base + "/nextbot/appointments/" + aid + "/update"
r = requests.post(url, headers=headers, json=body, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
