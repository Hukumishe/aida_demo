# xmind: get_client_appointments
# HTTP: GET {base_url}/clients/{client_id}/appointments?upcoming=true
#
# Клиент:
#   • client_id — если уже известен;
#   • иначе phone (или phone_lookup): внутри GET /nextbot/clients/verify → id.
# Имя в диалоге для поиска не используется.
#
# Args: base_url, api_key, organization_id,
#       client_id (опционально), phone / phone_lookup (если нет client_id)
# Предстоящие записи: BOOKED | ARRIVED, startAt >= сейчас.

base = args.get("base_url", "").rstrip("/")
cid = str(args.get("client_id", "") or "").strip()
phone_lookup = str(args.get("phone_lookup", "") or "").strip()
ph = str(args.get("phone", "") or "").strip()
org_id = str(args.get("organization_id", "") or "").strip()

headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
}

params = {"upcoming": "true"}

result = None
resolved_id = cid

if not resolved_id:
  verify_phone = phone_lookup if phone_lookup else ph
  if not verify_phone:
    result = {
      "ok": False,
      "status": 0,
      "data": [],
      "raw": None,
      "error": "missing_client_id_and_phone",
    }
  else:
    try:
      rv = requests.get(
        base + "/nextbot/clients/verify",
        headers=headers,
        params={"phone": verify_phone},
        timeout=15,
      )
      try:
        vj = rv.json() if rv.content else {}
      except Exception:
        vj = {}
      if not isinstance(vj, dict):
        vj = {}
      if not rv.ok:
        result = {
          "ok": False,
          "status": rv.status_code,
          "data": [],
          "raw": vj if vj else (rv.text or None),
          "error": "verify_failed",
        }
      elif not vj.get("found"):
        result = {
          "ok": False,
          "status": rv.status_code,
          "data": [],
          "raw": vj,
          "error": "client_not_found",
        }
      else:
        cl = vj.get("client")
        if not isinstance(cl, dict) or not cl.get("id"):
          result = {
            "ok": False,
            "status": 0,
            "data": [],
            "raw": None,
            "error": "verify_response_without_client_id",
          }
        else:
          resolved_id = str(cl.get("id")).strip()
    except Exception as e:
      result = {
        "ok": False,
        "status": 0,
        "data": [],
        "raw": None,
        "error": "verify_request_failed",
        "error_message": str(e),
      }

if result is None and resolved_id:
  url = base + "/clients/" + resolved_id + "/appointments"
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
      "client_id": resolved_id,
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
