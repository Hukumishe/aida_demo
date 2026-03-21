"""
Функции без соответствующих HTTP-эндпоинтов в текущем backend.
См. docs/NEXTBOT_PARTIAL_AND_MISSING.md
"""


def add_to_waitlist(*args, **kwargs):
  raise NotImplementedError("Waitlist API is not implemented in backend yet.")


def request_manager_invoice(*args, **kwargs):
  raise NotImplementedError("Manager invoice API is not implemented in backend yet.")


def generate_payment_link(*args, **kwargs):
  raise NotImplementedError("Payment link API is not implemented in backend yet.")


def verify_receipt_nighttime(*args, **kwargs):
  raise NotImplementedError("Night receipt verification API is not implemented in backend yet.")


def purchase_certificate(*args, **kwargs):
  raise NotImplementedError("Gift certificate purchase API is not implemented in backend yet.")


def validate_certificate_code(*args, **kwargs):
  raise NotImplementedError("Gift certificate validation API is not implemented in backend yet.")


def create_escalation_ticket(*args, **kwargs):
  raise NotImplementedError("Escalation ticket API is not implemented in backend yet.")


def dev_error_report(*args, **kwargs):
  raise NotImplementedError("Developer error reporting API is not implemented in backend yet.")
