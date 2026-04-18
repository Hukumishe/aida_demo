# Удобная обёртка: перенос времени (тот же API, что modify_booking)
# args: base_url, api_key, organization_id, appointment_id, start_at (ISO 8601 с таймзоной)
# Без import json — requests(..., json=...)

base = args.get("base_url", "").rstrip("/")
aid = str(args.get("appointment_id", ""))
start_at = str(args.get("start_at", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
  "Content-Type": "application/json",
}
body = {"startAt": start_at}
url = base + "/nextbot/appointments/" + aid + "/update"
r = requests.post(url, headers=headers, json=body, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
