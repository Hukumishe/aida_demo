# xmind: create_booking_request
# HTTP: POST {base_url}/nextbot/studios/{studio_id}/appointments — тело CreateAppointmentDto.
# Организация: заголовок X-Organization-Id (как в остальных nextbot-ручках).
#
# Args (обязательные): base_url, api_key, organization_id, studio_id,
#   staff_user_id, service_id, start_at (ISO 8601 с таймзоной, напр. +06:00).
# client_id — обязателен, либо phone / user_contact: id из GET /nextbot/clients/verify?phone=...
# Имена в args могут быть snake_case или camelCase (Nextbot): staffUserId, startAt, serviceId, organizationId, studioId.
# Опционально: prepayment_amount — в тело как prepaymentAmount; payload_json — полное тело JSON (CreateAppointmentDto), поля выше не собираются.
#
# Result: ok, status, data { id, status }, prompt.
# Ответ бэкенда — { outcome: 'booked', appointment } либо плоская запись; id/status берём из appointment.
# При занятом слоте бэкенд возвращает 409 Conflict — в этом случае отдаём агенту промпт о занятости слота,
# без автоматической постановки в лист ожидания. Очередь оформляется отдельной функцией add_to_waitlist.

try:
  AP = args
except NameError:
  AP = {}
if AP is None:
  AP = {}

base = AP.get("base_url", "").rstrip("/")
org_id = str(AP.get("organization_id", "") or "").strip()
sid = str(AP.get("studio_id", "") or "").strip()

headers = {
  "X-API-Key": AP.get("api_key", ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
  "Content-Type": "application/json",
}

pj = AP.get("payload_json", None)
body = None

if pj:
  try:
    body = json.loads(pj) if isinstance(pj, str) else pj
  except Exception:
    body = None
  if not isinstance(body, dict):
    body = None
else:
  staff_user_id = str(AP.get("staff_user_id") or AP.get("staffUserId") or "").strip()
  client_id = str(AP.get("client_id") or AP.get("clientId") or "").strip()
  if not client_id:
    phone = str(
      AP.get("phone")
      or AP.get("user_contact")
      or AP.get("userContact")
      or AP.get("q")
      or ""
    ).strip()
    if phone and base:
      try:
        vr = requests.get(
          base + "/nextbot/clients/verify",
          headers=headers,
          params={"phone": phone},
          timeout=15,
        )
        vfull = vr.json() if vr.content else {}
        if not isinstance(vfull, dict):
          vfull = {}
        if vfull.get("found"):
          cl = vfull.get("client")
          if isinstance(cl, dict) and cl.get("id") is not None:
            client_id = str(cl.get("id") or "").strip()
      except Exception:
        pass
  service_id = str(AP.get("service_id") or AP.get("serviceId") or "").strip()
  start_at = str(AP.get("start_at") or AP.get("startAt") or "").strip()
  if not staff_user_id or not client_id or not service_id or not start_at:
    missing = []
    if not staff_user_id:
      missing.append("staff_user_id")
    if not service_id:
      missing.append("service_id")
    if not start_at:
      missing.append("start_at")
    if not client_id:
      missing.append("client_id")
    phone_for_err = str(
      AP.get("phone")
      or AP.get("user_contact")
      or AP.get("userContact")
      or AP.get("q")
      or ""
    ).strip()
    only_client = len(missing) == 1 and "client_id" in missing
    if only_client and phone_for_err:
      err = "client_not_found_for_phone"
    elif only_client and not phone_for_err:
      err = "missing_client_id_or_phone"
    else:
      err = "missing_" + "_".join(missing)
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": "",
      "error": err,
      "missing": missing,
    }
    body = None
  else:
    body = {
      "staffUserId": staff_user_id,
      "clientId": client_id,
      "serviceId": service_id,
      "startAt": start_at,
    }
    pa = AP.get("prepayment_amount", None)
    if pa is not None and pa != "":
      try:
        body["prepaymentAmount"] = int(pa)
      except (TypeError, ValueError):
        pass

if body is None and pj:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "error": "invalid_payload_json",
  }

if body is not None:
  if not base:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": "",
      "error": "missing_base_url",
    }
  elif not org_id:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": "",
      "error": "missing_organization_id",
    }
  elif not sid:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": "",
      "error": "missing_studio_id",
    }
  else:
    url = base + "/nextbot/studios/" + sid + "/appointments"
    try:
      r = requests.post(url, headers=headers, json=body, timeout=15)
      try:
        full = r.json() if r.content else {}
      except Exception:
        full = {}

      if not isinstance(full, dict):
        full = {}

      prompt_text = full.get("prompt", "")
      if not prompt_text:
        prompt_text = full.get("create_booking_request", "")
      if not isinstance(prompt_text, str):
        prompt_text = str(prompt_text)

      appt = full.get("appointment")
      if isinstance(appt, dict):
        slim = {
          "id": appt.get("id"),
          "status": appt.get("status"),
        }
      else:
        slim = {
          "id": full.get("id"),
          "status": full.get("status"),
        }

      if r.ok and r.status_code in (200, 201):
        result = {
          "ok": True,
          "status": r.status_code,
          "data": slim,
          "prompt": prompt_text,
        }
      elif r.status_code == 409:
        slot_busy_prompt = (
          "Запрошенный слот занят — запись не создана, и клиент НЕ добавлен в лист ожидания автоматически. "
          "Сообщи клиенту, что выбранное время недоступно, и предложи альтернативы: другое время в тот же день, "
          "другого мастера или другой день. "
          "Если клиент не согласен на альтернативы и хочет ждать именно этот слот/окно — "
          "получи от него явное согласие на лист ожидания и только после этого вызови функцию add_to_waitlist "
          "с параметрами желаемого визита (date, time_range, staff_user_id)."
        )
        result = {
          "ok": False,
          "status": r.status_code,
          "data": None,
          "prompt": prompt_text or slot_busy_prompt,
          "error": "slot_conflict",
          "raw": full if full else (r.text or None),
        }
      else:
        result = {
          "ok": False,
          "status": r.status_code,
          "data": None,
          "prompt": prompt_text,
          "raw": full if full else (r.text or None),
        }
    except Exception as e:
      result = {
        "ok": False,
        "status": 0,
        "data": None,
        "prompt": "",
        "error": "request_failed",
        "error_message": str(e),
      }
