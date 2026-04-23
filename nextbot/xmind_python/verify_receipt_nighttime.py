# xmind: verify_receipt_nighttime
# HTTP: POST {base_url}/nextbot/verify-receipt-nighttime
#
# Ночной контроллер оплат — финал ветки самостоятельного бронирования в нерабочее время.
# Вызывается агентом СТРОГО после того, как:
#   1) request_manager_invoice вернул ночной путь (выданы реквизиты Kaspi и включён 30-мин таймер),
#   2) клиент прислал скриншот/файл чека,
#   3) агент vision-моделью визуально сверил на чеке название ИП, дату и сумму.
#
# Бэкенд:
#   • переводит запись TENTATIVE → PENDING_CONFIRMATION,
#   • сбрасывает holdExpiresAt (крон больше не отменит бронь),
#   • ставит утреннюю задачу менеджеру на сверку чека с выпиской Kaspi.
#
# Args (обязательные): base_url, api_key, organization_id, appointment_id, phone.
# Идентификатор client_id НЕ передаём — пользуемся универсальным phone (whatsapp).
# Имена в args принимаются как snake_case, так и camelCase (appointmentId / organizationId).
#
# Result: ok, status, data { status?, appointmentId?, taskId?, alreadyProcessed? }, prompt.
# Из ответа бэкенда оставляем только лёгкие поля статуса — тяжёлые объекты отсекаем.

DEFAULT_PROMPT = (
  "Чек принят, бронь удерживается до утренней сверки менеджером с выпиской Kaspi. "
  "Коротко и вежливо сообщи клиенту: оплата получена, запись закреплена, таймер автоотмены снят. "
  "Обозначь, что окончательное подтверждение придёт после сверки менеджером (обычно в первой половине дня), "
  "и попроси сохранить чек на случай вопросов. Не обещай мгновенное подтверждение и не называй внутренних ID."
)

base = str(args.get("base_url", "") or "").rstrip("/")
org_id = str(args.get("organization_id", "") or args.get("organizationId", "") or "").strip()
api_key = args.get("api_key", "")

appointment_id = str(args.get("appointment_id", "") or args.get("appointmentId", "") or "").strip()
phone = str(args.get("phone", "") or args.get("user_contact", "") or args.get("userContact", "") or "").strip()

debug("verify_receipt_nighttime: start")
debug("appointment_id=" + appointment_id + " phone=" + phone)

missing = []
if not appointment_id:
  missing.append("appointment_id")
if not phone:
  missing.append("phone")

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
  debug("verify_receipt_nighttime: missing params " + ",".join(missing))
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "error": "missing_" + "_".join(missing),
    "missing": missing,
  }
else:
  url = base + "/nextbot/verify-receipt-nighttime"
  headers = {
    "X-API-Key": api_key,
    "X-Organization-Id": org_id,
    "Accept": "application/json",
    "Content-Type": "application/json",
  }
  body = {
    "appointmentId": appointment_id,
    "phone": phone,
    "organizationId": org_id,
  }

  try:
    debug("verify_receipt_nighttime: POST " + url)
    r = requests.post(url, headers=headers, json=body, timeout=(3, 10))
    debug("verify_receipt_nighttime: status=" + str(r.status_code))

    try:
      full = r.json() if r.content else {}
    except Exception:
      full = {}
    if not isinstance(full, dict):
      full = {}

    prompt_text = full.get("prompt", "")
    if not prompt_text:
      prompt_text = full.get("verify_receipt_nighttime", "")
    if not isinstance(prompt_text, str):
      prompt_text = str(prompt_text)

    slim = {}
    appt = full.get("appointmentId") or full.get("appointment_id")
    if appt:
      slim["appointmentId"] = appt
    status_value = full.get("status")
    if status_value:
      slim["status"] = status_value
    task_id = full.get("taskId") or full.get("task_id")
    if task_id:
      slim["taskId"] = task_id
    if full.get("alreadyProcessed"):
      slim["alreadyProcessed"] = True

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
    debug("verify_receipt_nighttime: exception " + str(e))
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": DEFAULT_PROMPT,
      "error": "request_failed",
      "error_message": str(e),
    }
