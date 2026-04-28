# xmind: create_escalation_ticket
# HTTP: POST {base_url}/nextbot/create-escalation-ticket
# Назначение: передать менеджеру сложный кейс (жалоба/негатив/сложный вопрос).
# Args (обязательные): base_url, api_key, organization_id.
# Args (целевые): phone, issue_summary.
# result: { ok, status, data, prompt }.
# Успех: data { taskId, sharedForManagers }.

try:
  AP = args
except NameError:
  AP = {}
if AP is None:
  AP = {}

ESCALATION_PROMPT = (
  "СИСТЕМНОЕ СООБЩЕНИЕ: вопрос клиента передан руководству/старшему менеджеру. "
  "ТВОИ ДЕЙСТВИЯ: 1) прояви эмпатию и поблагодари клиента за обращение; "
  "2) спокойно объясни, что ситуация зафиксирована и передана ответственному менеджеру; "
  "3) корректно управь ожиданиями: ответ будет в ближайшее рабочее время (без точных минут и дедлайнов); "
  "4) заверши диалог вежливо, подтвердив, что клиент может написать дополнения в этот чат."
)

base = str(AP.get("base_url") or AP.get("baseUrl") or "").rstrip("/")
org_id = str(AP.get("organization_id") or AP.get("organizationId") or "").strip()
api_key = AP.get("api_key") or AP.get("apiKey") or ""
phone = str(AP.get("phone") or AP.get("user_contact") or AP.get("userContact") or "").strip()
issue_summary = str(AP.get("issue_summary") or AP.get("issueSummary") or "").strip()

headers = {
  "X-API-Key": api_key,
  "X-Organization-Id": org_id,
  "Accept": "application/json",
  "Content-Type": "application/json",
}
body = {
  "organizationId": org_id,
  "phone": phone,
  "issueSummary": issue_summary,
}

status_code = 0
prompt_text = ESCALATION_PROMPT
task_id = None
shared = None
raw_payload = None
error_code = None
error_message = None

if not base:
  error_code = "missing_base_url"
elif not org_id:
  error_code = "missing_organization_id"
elif not issue_summary:
  error_code = "missing_issue_summary"
else:
  try:
    url = base + "/nextbot/create-escalation-ticket"
    r = requests.post(url, headers=headers, json=body, timeout=(3, 10))
    status_code = r.status_code
    try:
      full = r.json() if r.content else {}
    except Exception:
      full = {}
    if not isinstance(full, dict):
      full = {}
    raw_payload = full if full else (r.text or None)

    dynamic_prompt = full.get("create_escalation_ticket", "")
    if dynamic_prompt:
      prompt_text = str(dynamic_prompt)

    task_id = full.get("taskId")
    shared = full.get("sharedForManagers")

    if not r.ok:
      error_code = "request_failed"
      error_message = "backend_status_" + str(r.status_code)
    elif not task_id:
      error_code = "task_not_created"
  except Exception as e:
    status_code = 0
    error_code = "request_failed"
    error_message = str(e)
    debug("create_escalation_ticket: request_failed")

ok = error_code is None and bool(task_id)
result = {
  "ok": ok,
  "status": status_code,
  "data": {
    "taskId": task_id,
    "sharedForManagers": bool(shared) if shared is not None else True,
  } if ok else None,
  "create_escalation_ticket": prompt_text,
  "prompt": prompt_text,
}
if not ok:
  result["error"] = error_code or "request_failed"
  if error_message:
    result["error_message"] = error_message
  if raw_payload is not None:
    result["raw"] = raw_payload
