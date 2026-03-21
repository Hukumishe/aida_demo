"""
Интеграция Nextbot с backend AIDA через HTTP (X-API-Key = NEXTBOT_API_KEY).

Пример:
  from nextbot import AidaConfig, verify_client_status, register_new_client
  cfg = AidaConfig(base_url="https://api.example.com", api_key="...", studio_id="stu_...")
"""

from nextbot.config import AidaConfig
from nextbot.company import get_company_context, get_studio_details
from nextbot.clients import (
  verify_client_status,
  register_new_client,
  process_survey_answers,
  get_client_profile,
  list_client_appointments,
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
from nextbot.prompts import list_prompts, get_prompt
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
  "get_studio_details",
  "verify_client_status",
  "register_new_client",
  "process_survey_answers",
  "get_client_profile",
  "list_client_appointments",
  "check_loyalty_status",
  "get_referral_code",
  "get_services_and_prices",
  "get_active_promotions",
  "check_availability",
  "create_booking_request",
  "modify_booking",
  "reschedule_booking",
  "cancel_booking",
  "list_prompts",
  "get_prompt",
  "add_to_waitlist",
  "request_manager_invoice",
  "generate_payment_link",
  "verify_receipt_nighttime",
  "purchase_certificate",
  "validate_certificate_code",
  "create_escalation_ticket",
  "dev_error_report",
]
