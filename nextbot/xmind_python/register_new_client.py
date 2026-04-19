# xmind: register_new_client
# HTTP: POST {base_url}/nextbot/clients/register  (тело CreateClientDto)
# Args: base_url, api_key, organization_id
# Либо payload_json (строка JSON), либо first_name, phone [, last_name, patronymic, instagram,
# referral_link_id (маркетинговая ссылка → источник), birth_date, notes, bonuses, discount, balance]
# Ответ: созданный клиент + поле "register_new_client" (промпт).

base = args.get("base_url", "").rstrip("/")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
  "Content-Type": "application/json",
}
url = base + "/nextbot/clients/register"
pj = args.get("payload_json", None)
if pj:
  body = json.loads(pj) if isinstance(pj, str) else pj
else:
  body = {
    "firstName": args.get("first_name", ""),
    "phone": args.get("phone", ""),
  }
  if args.get("last_name"):
    body["lastName"] = args.get("last_name")
  if args.get("patronymic"):
    body["patronymic"] = args.get("patronymic")
  if args.get("instagram"):
    body["instagram"] = args.get("instagram")
  rid = args.get("referral_link_id")
  if rid:
    body["referralLinkId"] = rid
  if args.get("birth_date"):
    body["birthDate"] = args.get("birth_date")
  if args.get("notes") is not None:
    body["notes"] = args.get("notes")
  for k, a in (("bonuses", "bonuses"), ("discount", "discount"), ("balance", "balance")):
    v = args.get(a)
    if v is not None and v != "":
      body[k] = int(v)
r = requests.post(url, headers=headers, json=body, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
