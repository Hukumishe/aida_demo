# xmind: get_referral_code
# HTTP: GET {base_url}/nextbot/clients/referral?phone=...
# Args: base_url, api_key, organization_id [, phone]
# Ответ: referralCode и поле "get_referral_code" (промпт).

base = args.get("base_url", "").rstrip("/")
phone = args.get("phone", "")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/clients/referral"
r = requests.get(url, headers=headers, params={"phone": phone}, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
