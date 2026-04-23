# xmind: modify_booking (перенос, отмена, предоплата — POST с телом UpdateAppointmentDto)
# HTTP: POST {base_url}/nextbot/appointments/{appointmentId}/update
# Args: base_url, api_key, organization_id, appointment_id, patch_json (строка JSON)
# Примеры patch_json: {"status":"CANCELLED"} или {"startAt":"2025-01-15T10:00:00+06:00"}
# Ответ: обновлённая запись + поле "modify_booking" (промпт).

base = args.get("base_url", "").rstrip("/")
aid = str(args.get("appointment_id", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
  "Content-Type": "application/json",
}
pj = args.get("patch_json", "{}")
body = json.loads(pj) if isinstance(pj, str) else pj
url = base + "/nextbot/appointments/" + aid + "/update"
r = requests.post(url, headers=headers, json=body, timeout=(3, 10))
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
