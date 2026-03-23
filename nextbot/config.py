from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class AidaConfig:
  """
  Конфигурация доступа к backend AI-DA.

  - base_url: только хост (например https://demo-studio-production.up.railway.app), без /nextbot
  - api_key: значение NEXTBOT_API_KEY на backend (заголовок X-API-Key)
  - studio_id: id филиала (из GET /nextbot/context), используется во всех вызовах со :studioId в пути
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


def nextbot_api_root(cfg: AidaConfig) -> str:
  """Базовый URL префикса Nest: `GET {root}/context`, `GET {root}/studios/:id/services`, …"""
  return f"{cfg.base_url.rstrip('/')}/nextbot"
