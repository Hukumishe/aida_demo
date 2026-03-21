import json
from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers
from .get_client_profile import get_client_profile


def process_survey_answers(
  cfg: AidaConfig,
  client_id: str,
  answers: Dict[str, Any],
  *,
  merge_into_notes: bool = True,
  survey_prefix: str = "[NEXTBOT_SURVEY]",
) -> Dict[str, Any]:
  """
  Фиксация ответов анкеты через PATCH /clients/:id (поле notes).

  В API нет отдельной сущности «анкета» — ответы сериализуются в notes.
  При merge_into_notes=True дописывает блок к существующим notes.
  """
  block = f"{survey_prefix} {json.dumps(answers, ensure_ascii=False)}"
  if merge_into_notes:
    existing = get_client_profile(cfg, client_id)
    old = (existing.get("notes") or "").strip()
    new_notes = f"{old}\n\n{block}".strip() if old else block
  else:
    new_notes = block

  url = f"{cfg.base_url}/clients/{client_id}"
  resp = requests.patch(
    url,
    headers=build_headers(cfg),
    json={"notes": new_notes},
    timeout=10,
  )
  resp.raise_for_status()
  return resp.json()
