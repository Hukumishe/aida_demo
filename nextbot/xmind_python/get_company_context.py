# xmind: get_company_context
# HTTP: GET {base_url}/nextbot/context
# Args: base_url, api_key, organization_id  (для API-ключа обязателен X-Organization-Id)
# Ответ JSON: organizationId, studios[], плюс строка промпта с портала в поле "get_company_context".
# Target (в том же ответе): targetPromos[] ({ id, promoText, title, mechanics }), promo_text[] —
#   дословное совпадение сообщения клиента с promo_text → вызов target_promo.

base = args.get("base_url", "").rstrip("/")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/context"
r = requests.get(url, headers=headers, timeout=(2.5, 7))
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
if isinstance(data, dict):
  target_promos = data.get("targetPromos")
  if not isinstance(target_promos, list):
    target_promos = []
  promo_text = data.get("promo_text")
  if not isinstance(promo_text, list):
    promo_text = data.get("promoText")
  if not isinstance(promo_text, list):
    promo_text = []
  result["targetPromos"] = target_promos
  result["promo_text"] = promo_text
