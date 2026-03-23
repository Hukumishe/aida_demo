# xmind: check_availability
# args: base_url, api_key, studio_id, date (YYYY-MM-DD)
# опционально: staff_user_id, service_id, duration_minutes, slot_step_minutes
# Ответ API: freeSlots (только свободные окна), check_availability (текст промпта для ИИ), durationMinutes, slotStepMinutes, date, studioId

base = args.get("base_url", "").rstrip("/")
sid = str(args.get("studio_id", ""))
date = args.get("date", "")
staff = args.get("staff_user_id", None)
if staff == "":
  staff = None
headers = {
  "X-API-Key": args.get("api_key", ""),
  "Accept": "application/json",
}
params = {"date": date}
if staff:
  params["staffUserId"] = staff
sid_svc = args.get("service_id", None)
if sid_svc:
  params["serviceId"] = str(sid_svc)
dm = args.get("duration_minutes", None)
if dm is not None and dm != "":
  params["durationMinutes"] = str(int(dm))
ss = args.get("slot_step_minutes", None)
if ss is not None and ss != "":
  params["slotStepMinutes"] = str(int(ss))
url = base + "/nextbot/studios/" + sid + "/availability-raw"
r = requests.get(url, headers=headers, params=params, timeout=20)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
