# xmind: process_survey_answers
# HTTP: POST {base_url}/nextbot/clients/{clientId}/survey
# Args: base_url, api_key, organization_id, client_id, answers_json
# Опционально: merge_into_notes (по умолчанию true), survey_prefix
# Ответ: обновлённый клиент + поле "process_survey_answers" (промпт).

base = args.get("base_url", "").rstrip("/")
cid = str(args.get("client_id", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
  "Content-Type": "application/json",
}
answers_raw = args.get("answers_json", "{}")
answers = json.loads(answers_raw) if isinstance(answers_raw, str) else answers_raw
m = args.get("merge_into_notes", True)
if isinstance(m, str):
  merge_into_notes = m.lower() in ("1", "true", "yes", "on")
else:
  merge_into_notes = bool(m)
body = {
  "answers": answers,
  "mergeIntoNotes": merge_into_notes,
  "surveyPrefix": args.get("survey_prefix", "[NEXTBOT_SURVEY]"),
}
url = base + "/nextbot/clients/" + cid + "/survey"
r = requests.post(url, headers=headers, json=body, timeout=(3, 10))
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
