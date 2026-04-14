#!/usr/bin/env python3
"""
JAMB PDF Parser — extracts questions from PDFs that have embedded answer keys.
Supports formats: GOV (single-column), UTME two-column (ECO, BIO, LIT).

Usage:
    python parse-jamb-pdf.py <pdf_path> <subject_code>

Outputs JSON to stdout:
    [{"text": "...", "year": 2010, "options": [{"label": "A", "text": "...", "isCorrect": false}, ...]}, ...]
"""

import sys
import json
import re
import subprocess
from pathlib import Path

import pdfplumber

# Force UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


# ─── text cleanup ─────────────────────────────────────────────────────────────

# Watermark/noise characters that appear sprinkled in OCR output
NOISE_CHARS_RE = re.compile(
    r"(?:Download MySchoolGist.*?(?=\n|$)|https?://\S+|www\.\S+)"
    r"|(?<!\w)[wmoist]{1,2}(?!\w)",  # isolated OCR watermark letters
    re.IGNORECASE,
)

WATERMARK_LINE_RE = re.compile(
    r"^.*(?:myschoolgist|Download MySchoolGist|cbt/).*$", re.IGNORECASE | re.MULTILINE
)

def clean(text: str) -> str:
    text = WATERMARK_LINE_RE.sub("", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove isolated single letters that are OCR watermark artifacts
    # (they appear between words like "A. text o B. text" -> "A. text B. text")
    text = re.sub(r"\s+[a-z]\s+(?=[A-Z])", " ", text)
    return text.strip()


# ─── pdfplumber column-aware extractor ────────────────────────────────────────

def extract_text_with_columns(pdf_path: str) -> str:
    """
    For each page, split into left and right halves using bbox.
    This properly separates two-column layouts.
    """
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            w, h = page.width, page.height
            mid = w / 2

            left = page.within_bbox((0, 0, mid, h)).extract_text() or ""
            right = page.within_bbox((mid, 0, w, h)).extract_text() or ""

            # If right column has meaningful content, append separately
            right_stripped = right.strip()
            if len(right_stripped) > 30:
                full_text += left + "\n" + right_stripped + "\n\n"
            else:
                full_text += left + "\n\n"

    return full_text


def pdftotext_simple(pdf_path: str) -> str:
    """Plain pdftotext for single-column PDFs (GOV)."""
    result = subprocess.run(
        ["pdftotext", pdf_path, "-"],
        capture_output=True, text=True, timeout=60
    )
    return result.stdout


# ─── answer-key parsers ───────────────────────────────────────────────────────

def parse_answer_keys_gov(text: str) -> dict:
    """
    GOV-style: '1.D, 2.A, 3.E, 4.C, ...' comma-separated on one line.
    Returns {question_number: answer_letter}
    """
    answers = {}
    for m in re.finditer(r"(\d+)\.([A-E])", text):
        answers[int(m.group(1))] = m.group(2)
    return answers


def parse_answer_keys_utme(text: str) -> dict:
    """
    UTME-style: 'ANSWER KEYS: 1. B 2. A 3. C ...' or multi-line after 'ANSWER KEYS'.
    Returns {question_number: answer_letter}
    """
    answers = {}
    blocks = re.split(r"ANSWER\s+KEYS?:?\s*", text, flags=re.IGNORECASE)
    for block in blocks[1:]:
        # Consume up to the next section break
        chunk = re.split(r"\n{2,}|(?=UTME\s+\d{4})|(?=\d{4}\s+\w)", block)[0]
        for m in re.finditer(r"(\d+)\.\s*([A-E])\b", chunk):
            q_num = int(m.group(1))
            if q_num not in answers:  # first key wins
                answers[q_num] = m.group(2)
    return answers


# ─── question block parser (shared) ──────────────────────────────────────────

def parse_question_block(block: str, q_num: int, year, answers: dict) -> dict | None:
    """
    Parse a single question block: question text + option lines.
    Options may be inline 'A. text B. text' or on separate lines.
    Returns dict or None if invalid.
    """
    block = block.strip()
    if len(block) < 15:
        return None

    # Locate first option marker
    opt_start = re.search(r"\b([A-E])[.\)]\s", block)
    if not opt_start:
        return None

    q_text = block[: opt_start.start()].replace("\n", " ").strip()
    opts_text = block[opt_start.start():].replace("\n", " ")

    # Split on option labels A. B. C. D. (E.)
    parts = re.split(r"\b([A-E])[.\)]\s", opts_text)
    # parts: ['', 'A', 'text_a', 'B', 'text_b', ...]

    options = []
    i = 1
    while i < len(parts) - 1:
        label = parts[i]
        opt_text = parts[i + 1].strip()
        # Remove trailing noise (page numbers, lone chars)
        opt_text = re.sub(r"\s+\d+\s*$", "", opt_text).strip()
        correct = answers.get(q_num)
        options.append({
            "label": label,
            "text": opt_text,
            "isCorrect": label == correct,
        })
        i += 2

    # Validation
    if len(options) < 2:
        return None
    if len(q_text) < 10:
        return None
    if not any(o["isCorrect"] for o in options):
        return None

    return {"text": q_text, "year": year, "options": options}


# ─── GOV parser ───────────────────────────────────────────────────────────────

def parse_gov(pdf_path: str) -> list:
    raw = pdftotext_simple(pdf_path)
    raw = clean(raw)

    answers = parse_answer_keys_gov(raw)

    questions = []
    current_year = None

    # Split on question numbers (GOV uses \d+: or \d+. format)
    # Use lookahead to keep the delimiter with its block
    parts = re.split(r"(?=(?:^|\n)(\d{1,3})[:.]\s)", raw, flags=re.MULTILINE)

    i = 0
    while i < len(parts):
        part = parts[i].strip()
        if not part:
            i += 1
            continue

        # Year detection
        if not re.match(r"^\d{1,3}[:.]\s", part):
            ym = re.search(r"\b(19\d{2}|20\d{2})\b", part)
            if ym:
                current_year = int(ym.group(1))
            i += 1
            continue

        m = re.match(r"^(\d{1,3})[:.]\s*(.*)", part, re.DOTALL)
        if not m:
            i += 1
            continue

        q_num = int(m.group(1))
        body = m.group(2)

        q = parse_question_block(body, q_num, current_year, answers)
        if q:
            questions.append(q)
        i += 1

    return questions


# ─── UTME (ECO, BIO, LIT) parser ─────────────────────────────────────────────

def parse_utme(pdf_path: str) -> list:
    raw = extract_text_with_columns(pdf_path)
    raw = clean(raw)

    # Identify year-section boundaries
    year_re = re.compile(
        r"(?:UTME\s+)?(\b(?:19|20)\d{2}\b)[\s\S]{0,60}?(?:QUESTIONS?|PAST\s+QUESTIONS?)?",
        re.IGNORECASE,
    )

    # Split into year sections
    splits = list(year_re.finditer(raw))
    if not splits:
        # No year markers — treat whole text as one section
        sections = [(None, raw)]
    else:
        sections = []
        for idx, match in enumerate(splits):
            year = int(match.group(1))
            start = match.start()
            end = splits[idx + 1].start() if idx + 1 < len(splits) else len(raw)
            sections.append((year, raw[start:end]))

    all_questions = []

    for year, section in sections:
        answers = parse_answer_keys_utme(section)
        if not answers:
            continue  # skip sections with no answer key

        # Remove answer-key text before parsing questions
        q_area = re.split(r"ANSWER\s+KEYS?", section, flags=re.IGNORECASE)[0]

        # Split into question blocks on '\n\d+. '
        blocks = re.split(r"\n(?=\d{1,3}\.\s)", q_area)

        for block in blocks:
            block = block.strip()
            m = re.match(r"^(\d{1,3})\.\s+(.*)", block, re.DOTALL)
            if not m:
                continue
            q_num = int(m.group(1))
            body = m.group(2)

            q = parse_question_block(body, q_num, year, answers)
            if q:
                all_questions.append(q)

    return all_questions


# ─── No-answer-key parser (COM, ACC, CRK) ─────────────────────────────────────
# These PDFs have no embedded answer keys — extract questions + options only.
# isCorrect will be False for all options (answers can be added later).

def parse_no_answers(pdf_path: str) -> list:
    """
    Two-column pdfplumber extraction for PDFs without answer keys.
    Extracts every question block with its options; isCorrect=False for all.
    """
    raw = extract_text_with_columns(pdf_path)
    raw = clean(raw)

    plain_year = re.compile(r"\b(19\d{2}|20\d{2})\b")

    # Split into year sections
    splits = list(re.finditer(r"\b(19\d{2}|20\d{2})\b", raw))
    if splits:
        sections = []
        for idx, match in enumerate(splits):
            year = int(match.group(1))
            start = match.start()
            end = splits[idx + 1].start() if idx + 1 < len(splits) else len(raw)
            sections.append((year, raw[start:end]))
    else:
        sections = [(None, raw)]

    all_questions = []

    for year, section in sections:
        # Split on question number boundaries
        blocks = re.split(r"\n(?=\d{1,3}\.\s)", section)
        for block in blocks:
            block = block.strip()
            m = re.match(r"^(\d{1,3})\.\s+(.*)", block, re.DOTALL)
            if not m:
                continue
            body = m.group(2)

            opt_start = re.search(r"\b([A-E])[.\)]\s", body)
            if not opt_start:
                continue

            q_text = body[: opt_start.start()].replace("\n", " ").strip()
            opts_text = body[opt_start.start():].replace("\n", " ")

            parts = re.split(r"\b([A-E])[.\)]\s", opts_text)
            options = []
            i = 1
            while i < len(parts) - 1:
                label = parts[i]
                opt_text = parts[i + 1].strip()
                opt_text = re.sub(r"\s+\d+\s*$", "", opt_text).strip()
                options.append({"label": label, "text": opt_text, "isCorrect": False})
                i += 2

            if len(options) < 2 or len(q_text) < 10:
                continue

            all_questions.append({"text": q_text, "year": year, "options": options})

    return all_questions


# ─── main ─────────────────────────────────────────────────────────────────────

GOV_SUBJECTS = {"GOV"}
UTME_SUBJECTS = {"ECO", "BIO", "LIT"}
NO_ANSWER_SUBJECTS = {"COM", "ACC", "CRK"}


def main():
    if len(sys.argv) < 3:
        print("Usage: parse-jamb-pdf.py <pdf_path> <SUBJECT_CODE>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    code = sys.argv[2].upper()

    if not Path(pdf_path).exists():
        print(f"File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    if code in GOV_SUBJECTS:
        questions = parse_gov(pdf_path)
    elif code in UTME_SUBJECTS:
        questions = parse_utme(pdf_path)
    elif code in NO_ANSWER_SUBJECTS:
        questions = parse_no_answers(pdf_path)
    else:
        print(f"Unsupported subject for Python parser: {code}", file=sys.stderr)
        sys.exit(2)

    print(json.dumps(questions, ensure_ascii=False))


if __name__ == "__main__":
    main()
