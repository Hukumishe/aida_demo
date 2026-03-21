from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class AidaConfig:
  """
  Конфигурация доступа к backend AI-DA.

  - base_url: базовый URL backend (без завершающего /)
  - api_key: значение NEXTBOT_API_KEY на backend (заголовок X-API-Key)
  - studio_id: studioId контекста бота (филиал по умолчанию)
  - company_id: опционально, только для отображения в ответе get_company_context
  """

  base_url: str
  api_key: str
  studio_id: str
  company_id: Optional[str] = None


def build_headers(cfg: AidaConfig) -> Dict[str, str]:
  return {
    "X-API-Key": cfg.api_key,
    "Accept": "application/json",
    "Content-Type": "application/json",
  }
