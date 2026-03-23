"""
Сборка PDF из Markdown (кириллица, шрифт Windows Arial/Segoe).
Требуется: pip install fpdf2

Запуск из корня репозитория:
  python scripts/generate-nextbot-functions-pdf.py              # партнёрское руководство
  python scripts/generate-nextbot-functions-pdf.py --reference  # краткая техническая сводка
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARTNER_MD = ROOT / "docs" / "PARTNER_NEXTBOT_AIDA_GUIDE.md"
PARTNER_PDF = ROOT / "docs" / "PARTNER_NEXTBOT_AIDA_GUIDE.pdf"
REFERENCE_MD = ROOT / "docs" / "NEXTBOT_FUNCTIONS_REFERENCE.md"
REFERENCE_PDF = ROOT / "docs" / "NEXTBOT_FUNCTIONS_REFERENCE.pdf"


def find_unicode_font() -> str | None:
  windir = os.environ.get("WINDIR", r"C:\Windows")
  for name in ("arial.ttf", "Arial.ttf", "segoeui.ttf", "calibri.ttf"):
    p = Path(windir) / "Fonts" / name
    if p.is_file():
      return str(p)
  return None


def main() -> int:
  parser = argparse.ArgumentParser(description="MD → PDF для документации Nextbot/AIDA")
  parser.add_argument(
    "--reference",
    action="store_true",
    help="Собрать NEXTBOT_FUNCTIONS_REFERENCE.pdf вместо партнёрского гайда",
  )
  args = parser.parse_args()
  md_path = REFERENCE_MD if args.reference else PARTNER_MD
  pdf_path = REFERENCE_PDF if args.reference else PARTNER_PDF

  try:
    from fpdf import FPDF
  except ImportError:
    print("Установите: pip install fpdf2", file=sys.stderr)
    return 1

  if not md_path.is_file():
    print(f"Нет файла: {md_path}", file=sys.stderr)
    return 1

  text = md_path.read_text(encoding="utf-8")

  pdf = FPDF()
  pdf.set_margins(12, 12, 12)
  pdf.set_auto_page_break(auto=True, margin=15)
  pdf.add_page()
  col_w = pdf.epw

  font_path = find_unicode_font()
  if font_path:
    pdf.add_font("Uifont", "", font_path)
    pdf.set_font("Uifont", size=10)
  else:
    pdf.set_font("Helvetica", size=10)
    print("Предупреждение: не найден Arial/Segoe в Windows/Fonts — кириллица может отобразиться некорректно.", file=sys.stderr)

  in_code = False
  for raw_line in text.splitlines():
    line = raw_line.rstrip()
    if line.startswith("```"):
      in_code = not in_code
      pdf.ln(3)
      continue
    if in_code:
      if font_path:
        pdf.set_font("Uifont", size=9)
      else:
        pdf.set_font("Helvetica", size=9)
      pdf.multi_cell(col_w, 4, line if line else " ")
      if font_path:
        pdf.set_font("Uifont", size=10)
      else:
        pdf.set_font("Helvetica", size=10)
      continue
    if not line:
      pdf.ln(4)
      continue
    # Упрощаем markdown для PDF
    if line.startswith("# "):
      if font_path:
        pdf.set_font("Uifont", size=16)
      else:
        pdf.set_font("Helvetica", size=16)
      pdf.multi_cell(col_w, 8, re.sub(r"^#\s+", "", line))
      if font_path:
        pdf.set_font("Uifont", size=10)
      else:
        pdf.set_font("Helvetica", size=10)
      pdf.ln(2)
      continue
    if line.startswith("## "):
      if font_path:
        pdf.set_font("Uifont", size=13)
      else:
        pdf.set_font("Helvetica", size=13)
      pdf.multi_cell(col_w, 7, re.sub(r"^##\s+", "", line))
      if font_path:
        pdf.set_font("Uifont", size=10)
      else:
        pdf.set_font("Helvetica", size=10)
      pdf.ln(2)
      continue
    if line.startswith("### "):
      if font_path:
        pdf.set_font("Uifont", size=11)
      else:
        pdf.set_font("Helvetica", size=11)
      pdf.multi_cell(col_w, 6, re.sub(r"^###\s+", "", line))
      if font_path:
        pdf.set_font("Uifont", size=10)
      else:
        pdf.set_font("Helvetica", size=10)
      pdf.ln(1)
      continue
    line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
    line = re.sub(r"`([^`]+)`", r"\1", line)
    if re.match(r"^\|?[\s\-:|]+\|?$", line) and "---" in line:
      pdf.ln(2)
      continue
    if line.startswith("|") and " | " in line:
      line = line.replace("|", " ").strip()
    if line.startswith("---"):
      pdf.ln(2)
      continue
    if not line.strip():
      continue
    try:
      pdf.multi_cell(col_w, 5, line)
    except Exception:
      pdf.multi_cell(col_w, 5, "[строка не отображена]")

  pdf.output(str(pdf_path))
  print(f"OK: {pdf_path}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
