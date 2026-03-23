# xmind: create_booking_request
# args: base_url, api_key, studio_id
# тело: либо payload_json (строка JSON CreateAppointmentDto), либо staff_user_id, client_id, service_id, start_at [, prepayment_amount]
# Без import json — см. register_new_client.py

base = args.get("base_url", "").rstrip("/")
sid = str(args.get("studio_id", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "Accept": "application/json",
  "Content-Type": "application/json",
}
url = base + "/nextbot/studios/" + sid + "/appointments"
pj = args.get("payload_json", None)
if pj:
  body = json.loads(pj) if isinstance(pj, str) else pj
else:
  body = {
    "staffUserId": str(args.get("staff_user_id", "")),
    "clientId": str(args.get("client_id", "")),
    "serviceId": str(args.get("service_id", "")),
    "startAt": str(args.get("start_at", "")),
  }
  pa = args.get("prepayment_amount", None)
  if pa is not None and pa != "":
    body["prepaymentAmount"] = int(pa)
r = requests.post(url, headers=headers, json=body, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
