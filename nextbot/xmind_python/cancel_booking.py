# Обёртка: отмена записи (тот же API, что modify_booking)
# HTTP: POST {base_url}/nextbot/appointments/{id}/update  с телом {"status":"CANCELLED"}
# Args: base_url, api_key, organization_id, appointment_id

base = args.get("base_url", "").rstrip("/")
aid = str(args.get("appointment_id", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
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
