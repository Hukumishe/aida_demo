# xmind: get_client_appointments
# HTTP: GET {base_url}/clients/{client_id}/appointments?upcoming=true
# Args: base_url, api_key, organization_id, client_id
# Предстоящие «активные» записи: на бэкенде только status BOOKED | ARRIVED и startAt >= сейчас.
# Ответ: result.data — список словарей с полями id, startAt, endAt, status, studioId, serviceId,
#        serviceName, staffName (удобно для реплики бота); сырой массив — в result.raw при ok.

base = args.get("base_url", "").rstrip("/")
cid = str(args.get("client_id", "") or "").strip()
org_id = str(args.get("organization_id", "") or "").strip()

headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
}

params = {"upcoming": "true"}

if not cid:
  result = {
    "ok": False,
    "status": 0,
    "data": [],
    "raw": None,
    "error": "missing_client_id",
  }
else:
  url = base + "/clients/" + cid + "/appointments"
  try:
    r = requests.get(url, headers=headers, params=params, timeout=15)
    try:
      body = r.json() if r.content else []
    except Exception:
      body = r.text

    slim = []
    raw_list = body if isinstance(body, list) else []

    for a in raw_list:
      if not isinstance(a, dict):
        continue
      svc = a.get("service") if isinstance(a.get("service"), dict) else {}
      st = a.get("staff") if isinstance(a.get("staff"), dict) else {}
      sp = st.get("staffProfile") if isinstance(st.get("staffProfile"), dict) else {}
      fn = str(sp.get("firstName") or "").strip()
      ln = str(sp.get("lastName") or "").strip()
      staff_name = (fn + " " + ln).strip() or None
      slim.append({
        "id": a.get("id"),
        "startAt": a.get("startAt"),
        "endAt": a.get("endAt"),
        "status": a.get("status"),
        "studioId": a.get("studioId"),
        "serviceId": a.get("serviceId"),
        "serviceName": svc.get("name"),
        "staffName": staff_name,
      })

    result = {
      "ok": r.ok,
      "status": r.status_code,
      "data": slim if r.ok else [],
      "raw": raw_list if r.ok else body,
    }
  except Exception as e:
    result = {
      "ok": False,
      "status": 0,
      "data": [],
      "raw": None,
      "error": "request_failed",
      "error_message": str(e),
    }
