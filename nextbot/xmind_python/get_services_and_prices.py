# xmind: get_services_and_prices
# В Nextbot в «Параметры функции» добавь 4 параметра с именами ТОЧНО: base_url, api_key, organization_id, studio_id
# (или заполни блок «Тестовые аргументы» при нажатии «Тестировать код»).
# base_url — это адрес сервера БЕЗ /nextbot (переменная base ниже = тот же хост, просто без хвостового /).

base = args.get("base_url", "").rstrip("/")
sid = str(args.get("studio_id", ""))
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/services"
r = requests.get(url, headers=headers, params={"studioId": sid}, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}
