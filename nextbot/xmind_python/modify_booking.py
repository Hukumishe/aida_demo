# xmind: modify_booking (перенос, отмена, предоплата — одно тело UpdateAppointmentDto)
# args: base_url, api_key, appointment_id
# тело: patch_json — строка JSON, напр. {"status":"CANCELLED"} или {"startAt":"2025-01-15T10:00:00+06:00"}
# Без import json — json.loads / requests(..., json=...) в среде Nextbot.

base = args.get("base_url", "").rstrip("/")
aid = str(args.get("appointment_id", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "Accept": "application/json",
  "Content-Type": "application/json",
}
pj = args.get("patch_json", "{}")
body = json.loads(pj) if isinstance(pj, str) else pj
url = base + "/nextbot/appointments/" + aid + "/update"
r = requests.post(url, headers=headers, json=body, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
