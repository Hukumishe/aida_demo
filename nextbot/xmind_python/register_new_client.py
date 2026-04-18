# xmind: register_new_client
# args: base_url, api_key, organization_id
# тело: либо payload_json (строка JSON CreateClientDto), либо отдельные first_name, phone, last_name, birth_date, notes, ...
# Без import json: json.loads и requests(..., json=...) доступны в среде Nextbot.

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
