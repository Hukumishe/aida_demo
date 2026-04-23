# xmind: request_manager_invoice
# HTTP: POST {base_url}/nextbot/request-manager-invoice
#
# Вызывается сразу после успешного create_booking_request для предварительной брони.
# Бэкенд сам определяет время суток и возвращает нужный динамический промпт:
#   • Рабочее (дневное) время: ставит задачу живому менеджеру на выставление счета.
#   • Ночное время: возвращает промпт со статичными реквизитами Kaspi + активирует
#     30-минутный таймер удержания брони и инструктирует агента запросить чек от клиента.
# В оба случая итоговая инструкция для агента — в поле `prompt`.
#
# Args (обязательные): base_url, api_key, organization_id,
#                      appointment_id, phone, kaspi_details.
# Имена в args принимаются как snake_case, так и camelCase
# (appointmentId / kaspiDetails / organizationId).
#
# Result: ok, status, data { mode?, holdUntilAt?, status? }, prompt.
# Из ответа бэкенда оставляем только легкие поля маршрутизации/статуса — тяжелые объекты отсекаем.

DEFAULT_PROMPT = (
  "Запрос на выставление счёта принят. Дождись инструкции от бэкенда и следуй ей. "
  "Если бэкенд не вернул промпт — сообщи клиенту, что передал заявку менеджеру для выставления счёта, "
  "и попроси немного подождать."
)

base = str(args.get("base_url", "") or "").rstrip("/")
org_id = str(args.get("organization_id", "") or args.get("organizationId", "") or "").strip()
api_key = args.get("api_key", "")

appointment_id = str(args.get("appointment_id", "") or args.get("appointmentId", "") or "").strip()
phone = str(args.get("phone", "") or args.get("user_contact", "") or args.get("userContact", "") or "").strip()
kaspi_details = str(args.get("kaspi_details", "") or args.get("kaspiDetails", "") or "").strip()

debug("request_manager_invoice: start")
debug("appointment_id=" + appointment_id + " phone=" + phone + " kaspi_details=" + kaspi_details)

missing = []
if not appointment_id:
  missing.append("appointment_id")
if not phone:
  missing.append("phone")
if not kaspi_details:
  missing.append("kaspi_details")

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
elif missing:
  debug("request_manager_invoice: missing params " + ",".join(missing))
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "error": "missing_" + "_".join(missing),
    "missing": missing,
  }
else:
  url = base + "/nextbot/request-manager-invoice"
  headers = {
    "X-API-Key": api_key,
    "X-Organization-Id": org_id,
    "Accept": "application/json",
    "Content-Type": "application/json",
  }
  body = {
    "appointmentId": appointment_id,
    "phone": phone,
    "kaspiDetails": kaspi_details,
    "organizationId": org_id,
  }

  try:
    debug("request_manager_invoice: POST " + url)
    r = requests.post(url, headers=headers, json=body, timeout=(3, 10))
    debug("request_manager_invoice: status=" + str(r.status_code))

    try:
      full = r.json() if r.content else {}
    except Exception:
      full = {}
    if not isinstance(full, dict):
      full = {}

    prompt_text = full.get("prompt", "")
    if not prompt_text:
      prompt_text = full.get("request_manager_invoice", "")
    if not isinstance(prompt_text, str):
      prompt_text = str(prompt_text)

    slim = {}
    mode = full.get("mode") or full.get("route")
    if mode:
      slim["mode"] = mode
    hold_until = full.get("holdUntilAt") or full.get("holdUntil") or full.get("expiresAt")
    if hold_until:
      slim["holdUntilAt"] = hold_until
    if full.get("status"):
      slim["status"] = full.get("status")

    if r.ok and r.status_code in (200, 201):
      result = {
        "ok": True,
        "status": r.status_code,
        "data": slim,
        "prompt": prompt_text or DEFAULT_PROMPT,
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
    debug("request_manager_invoice: exception " + str(e))
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": DEFAULT_PROMPT,
      "error": "request_failed",
      "error_message": str(e),
    }
