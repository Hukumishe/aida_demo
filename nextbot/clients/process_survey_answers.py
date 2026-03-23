from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def process_survey_answers(
  cfg: AidaConfig,
  client_id: str,
  answers: Dict[str, Any],
  *,
  merge_into_notes: bool = True,
  survey_prefix: str = "[NEXTBOT_SURVEY]",
) -> Dict[str, Any]:
  """
  POST /nextbot/clients/:clientId/survey — сервер сам мержит блок в notes (NextbotSurveyDto).
  """
  url = f"{nextbot_api_root(cfg)}/clients/{client_id}/survey"
  payload: Dict[str, Any] = {
    "answers": answers,
    "mergeIntoNotes": merge_into_notes,
    "surveyPrefix": survey_prefix,
  }
  resp = requests.post(
    url,
    headers=build_headers(cfg),
    json=payload,
    timeout=10,
  )
  resp.raise_for_status()
  return resp.json()
