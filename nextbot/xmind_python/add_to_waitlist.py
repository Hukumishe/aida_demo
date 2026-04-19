# xmind: add_to_waitlist
# HTTP: POST {base_url}/nextbot/add-to-waitlist
# Вызывается агентом только после:
#   1) попытка записи create_booking_request на желаемый слот → 409 (слот занят),
#   2) альтернативы (другое время / мастер / день) клиенту не подошли,
#   3) клиент дал явное согласие ждать именно этот слот.
#
# Args (обязательные): base_url, api_key, organization_id.
# Args (целевые поля): studio_id, phone, date, time_range, staff_user_id (последний — опционально).
# Имена в args принимаются как snake_case, так и camelCase.
#
# Бэкенд считается всегда успешным (при HTTP 2xx); ветку ошибок не обрабатываем.
# Возврат: result = { ok, status, data, prompt }, где data пустой ({}),
# prompt — строгая системная инструкция с правилами ведения диалога (хардкод).

WAITLIST_PROMPT = (
  "Клиент добавлен в лист ожидания. Кратко и вежливо подтверди это клиенту. "
  "Объясни механику: как только желаемое окно (дата, указанное время/диапазон, и — если передан — выбранный мастер) "
  "освободится, система автоматически отправит уведомление в WhatsApp. Получив уведомление, клиент сможет подтвердить запись — "
  "места распределяются по порядку обращений. Обязательно обозначь ожидания: 100% гарантии записи нет, "
  "место может не освободиться или быть занято другим клиентом быстрее. "
  "В конце предложи подстраховку — забронировать запись на другой день или у другого мастера уже сейчас, "
  "чтобы клиент гарантированно получил услугу; при согласии используй функцию create_booking_request. "
  "Не упоминай внутренние идентификаторы и технические детали."
)

base = str(args.get("base_url", "") or "").rstrip("/")
org_id = str(args.get("organization_id", "") or args.get("organizationId", "") or "").strip()
api_key = args.get("api_key", "")

studio_id = str(args.get("studio_id", "") or args.get("studioId", "") or "").strip()
phone = str(args.get("phone", "") or args.get("user_contact", "") or args.get("userContact", "") or "").strip()
date = str(args.get("date", "") or "").strip()
time_range = str(args.get("time_range", "") or args.get("timeRange", "") or "").strip()
staff_user_id = str(args.get("staff_user_id", "") or args.get("staffUserId", "") or "").strip()

debug("add_to_waitlist: start studio=" + studio_id + " phone=" + phone + " date=" + date + " time_range=" + time_range)

url = base + "/nextbot/add-to-waitlist"
headers = {
  "X-API-Key": api_key,
  "X-Organization-Id": org_id,
  "Accept": "application/json",
  "Content-Type": "application/json",
}
body = {
  "studioId": studio_id,
  "phone": phone,
  "date": date,
  "timeRange": time_range,
  "staffUserId": staff_user_id,
}

status_code = 0
try:
  r = requests.post(url, headers=headers, json=body, timeout=15)
  status_code = r.status_code
  debug("add_to_waitlist: status=" + str(status_code))
except Exception as e:
  debug("add_to_waitlist: exception " + str(e))
  status_code = 0

result = {
  "ok": True,
  "status": status_code,
  "data": {},
  "prompt": WAITLIST_PROMPT,
}
