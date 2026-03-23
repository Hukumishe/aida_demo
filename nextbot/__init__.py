"""
Интеграция Nextbot с backend AIDA через HTTP (X-API-Key = NEXTBOT_API_KEY).

Публичный API совпадает с функциями из системного промпта xmind (aida_xmind.pdf).
HTTP-эндпоинты префикса /nextbot — см. docs/NEXTBOT_XMIND_API.md.

Пример:
  from nextbot import AidaConfig, verify_client_status, register_new_client
  cfg = AidaConfig(base_url="https://api.example.com", api_key="...", studio_id="stu_...")
  # base_url — без суффикса /nextbot; пути собираются как {base_url}/nextbot/...
"""

from nextbot.config import AidaConfig
from nextbot.company import get_company_context
from nextbot.clients import (
  verify_client_status,
  register_new_client,
  process_survey_answers,
  check_loyalty_status,
  get_referral_code,
)
from nextbot.services import get_services_and_prices
from nextbot.landing import get_active_promotions
from nextbot.schedule import check_availability
from nextbot.appointments import (
  create_booking_request,
  modify_booking,
  reschedule_booking,
  cancel_booking,
)
from nextbot.placeholders import (
  add_to_waitlist,
  request_manager_invoice,
  generate_payment_link,
  verify_receipt_nighttime,
  purchase_certificate,
  validate_certificate_code,
  create_escalation_ticket,
  dev_error_report,
)

__all__ = [
  "AidaConfig",
  "get_company_context",
  "verify_client_status",
  "register_new_client",
  "process_survey_answers",
  "check_loyalty_status",
  "get_referral_code",
  "get_services_and_prices",
  "get_active_promotions",
  "check_availability",
  "create_booking_request",
  "modify_booking",
  "reschedule_booking",
  "cancel_booking",
  "add_to_waitlist",
  "request_manager_invoice",
  "generate_payment_link",
  "verify_receipt_nighttime",
  "purchase_certificate",
  "validate_certificate_code",
  "create_escalation_ticket",
  "dev_error_report",
]
