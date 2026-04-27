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


def toAsciiDigits(value):
  out = []
  for ch in str(value or ""):
    if "0" <= ch <= "9":
      out.append(ch)
      continue
    if "\u0660" <= ch <= "\u0669":
      out.append(str(ord(ch) - ord("\u0660")))
      continue
    if "\u06F0" <= ch <= "\u06F9":
      out.append(str(ord(ch) - ord("\u06F0")))
      continue
    out.append(ch)
  return "".join(out)


def normalizePhone(rawPhone):
  raw = toAsciiDigits(rawPhone).strip()
  if not raw:
    return ""

  hadPlus = raw.startswith("+")
  digits = re.sub(r"\D", "", raw)
  if not digits:
    return ""

  if digits.startswith("00"):
    digits = digits[2:]
    hadPlus = True

  if (not hadPlus) and len(digits) == 11 and digits.startswith("8"):
    return "+7" + digits[1:]

  if (not hadPlus) and len(digits) == 11 and digits.startswith("05"):
    return "+90" + digits[1:]
  if (not hadPlus) and len(digits) == 10 and digits.startswith("5"):
    return "+90" + digits
  if (not hadPlus) and len(digits) == 12 and digits.startswith("90"):
    return "+" + digits

  if hadPlus or len(digits) >= 11:
    return "+" + digits
  return digits


def uniquePhoneCandidates(rawPhone):
  original = str(rawPhone or "").strip()
  normalized = normalizePhone(original)
  digits = re.sub(r"\D", "", toAsciiDigits(original))

  candidates = []
  candidates_seed = [normalized, original, ("+" + digits) if digits else "", digits]

  # Частые локальные варианты для KZ/RU:
  # +7XXXXXXXXXX <-> 7XXXXXXXXXX <-> 8XXXXXXXXXX
  if digits.startswith("7") and len(digits) == 11:
    candidates_seed.append("8" + digits[1:])
  if digits.startswith("8") and len(digits) == 11:
    candidates_seed.append("7" + digits[1:])
    candidates_seed.append("+7" + digits[1:])

  for p in candidates_seed:
    p2 = str(p or "").strip()
    if p2 and p2 not in candidates:
      candidates.append(p2)
  return candidates


def coalesceServiceIds(ap):
  """
  Совместимость для новой логики serviceIds/service_ids:
  - список/кортеж
  - JSON-массив в строке
  - CSV-строка
  - legacy serviceId/service_id
  """
  out = []
  for key in (
    "serviceIds",
    "ServiceIds",
    "service_ids",
    "service_id_list",
    "serviceIdList",
  ):
    raw = ap.get(key)
    if raw is None or raw == "":
      continue
    if isinstance(raw, (list, tuple)):
      for x in raw:
        s = str(x).strip()
        if s:
          out.append(s)
    else:
      text = str(raw).strip()
      if text.startswith("["):
        try:
          j = json.loads(text)
          if isinstance(j, list):
            for x in j:
              s = str(x).strip()
              if s:
                out.append(s)
        except Exception:
          if text.startswith("[") and text.endswith("]"):
            text = text[1:-1]
          for p in text.split(","):
            s = p.strip().strip("'").strip('"')
            if s:
              out.append(s)
      else:
        for p in text.split(","):
          s = p.strip().strip("'").strip('"')
          if s:
            out.append(s)
    if out:
      return out

  single = str(ap.get("service_id") or ap.get("serviceId") or "").strip()
  if single:
    return [single]
  return []


def extractClientIdFromVerifyResponse(payload):
  """
  Бэкенд verify может вернуть разные формы:
  - { found: true, client: { id: ... } }
  - { found: true, clientId: ... }
  - { found: true, data: { client: { id: ... } } }
  """
  if not isinstance(payload, dict):
    return ""

  # 1) top-level clientId
  cid = str(payload.get("clientId") or "").strip()
  if cid:
    return cid

  # 2) top-level client.id
  cl = payload.get("client")
  if isinstance(cl, dict):
    cid = str(cl.get("id") or "").strip()
    if cid:
      return cid

  # 3) nested data.clientId / data.client.id
  data_obj = payload.get("data")
  if isinstance(data_obj, dict):
    cid = str(data_obj.get("clientId") or "").strip()
    if cid:
      return cid
    cl2 = data_obj.get("client")
    if isinstance(cl2, dict):
      cid = str(cl2.get("id") or "").strip()
      if cid:
        return cid

  return ""

base = str(AP.get("base_url", "") or "").strip().rstrip("/")
org_id = str(AP.get("organization_id", "") or "").strip()
sid = str(AP.get("studio_id", "") or "").strip()

headers = {
  "X-API-Key": str(AP.get("api_key", "") or "").strip(),
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
  # По требованиям Nextbot client_id определяем только через номер телефона.
  client_id = ""
  phone_for_lookup = ""
  phone = str(
    AP.get("phone")
    or AP.get("user_contact")
    or AP.get("userContact")
    or AP.get("q")
    or ""
  ).strip()
  if phone and base:
    candidates = uniquePhoneCandidates(phone)
    if len(candidates) > 0:
      phone_for_lookup = candidates[0]
    for candidate in candidates:
      try:
        vr = requests.get(
          base + "/nextbot/clients/verify",
          headers=headers,
          params={"phone": candidate},
          timeout=(2.5, 5),
        )
        vfull = vr.json() if vr.content else {}
        if not isinstance(vfull, dict):
          vfull = {}
        if vfull.get("found"):
          client_id = extractClientIdFromVerifyResponse(vfull)
          # Если verify вернул found=true, но не отдал id, берём id через get_referral_code.
          if not client_id:
            try:
              rr = requests.get(
                base + "/nextbot/clients/referral",
                headers=headers,
                params={"phone": candidate},
                timeout=(2.5, 5),
              )
              rfull = rr.json() if rr.content else {}
              if not isinstance(rfull, dict):
                rfull = {}
              cid2 = str(rfull.get("clientId") or "").strip()
              if cid2:
                client_id = cid2
            except Exception:
              pass
          if client_id:
            phone_for_lookup = candidate
            break
      except Exception:
        pass
  service_ids = coalesceServiceIds(AP)
  service_id = service_ids[0] if len(service_ids) > 0 else ""
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
      "normalizedPhone": phone_for_lookup or normalizePhone(phone_for_err),
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
      r = requests.post(url, headers=headers, json=body, timeout=(3, 10))
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
