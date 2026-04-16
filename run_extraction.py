import os
import sys
import json
import time
import argparse
from pathlib import Path
import pdfplumber
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

PROMPT_TEMPLATE = """
Extract all multiple-choice JAMB past questions from the provided text.

Rules:
- For each question, reconstruct any mathematical expressions using LaTeX: inline math as $expression$, display math as $$expression$$
- Fix garbled symbols from PDF extraction (e.g. "x2" -> $x^2$, fractions, roots, etc.)
- Identify the correct answer from any answer key in the text, or use your knowledge to verify it
- Write a 1-2 sentence explanation for why the answer is correct
- Extract the year if shown (e.g. "1983", "UTME 2010"). If not shown, omit it or use the closest known block year.
- Skip incomplete questions or non-question content

Return ONLY a JSON array, no code blocks, no other text:
[
  {
    "text": "question text",
    "year": 1983,
    "options": [
      {"label": "A", "text": "option", "isCorrect": false},
      {"label": "B", "text": "option", "isCorrect": true},
      {"label": "C", "text": "option", "isCorrect": false},
      {"label": "D", "text": "option", "isCorrect": false}
    ],
    "explanation": "B is correct because..."
  }
]

Text:
{text}
"""

def process_chunk(text, attempt=1):
    if attempt > 4:
        print("Max attempts reached for chunk.")
        return []
        
    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a perfect JSON data extractor. You never output markdown backticks, only pure raw JSON."},
                {"role": "user", "content": PROMPT_TEMPLATE.replace("{text}", text)}
            ],
            model="llama-3.1-8b-instant",  # using 8B to avoid 70B TPM limits 
            temperature=0.1,
            max_tokens=2000
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()
            
        return json.loads(content)
    except Exception as e:
        print(f"Error on attempt {attempt}: {e}")
        time.sleep(10 * attempt)
        return process_chunk(text, attempt + 1)

def extract_from_pdf(filepath, subject_name, chunk_size=1):
    out_path = Path(f"question_pdfs/{subject_name}-questions.json")
    all_questions = []
    
    # Check if already exists to allow resume
    if out_path.exists():
        try:
            all_questions = json.loads(out_path.read_text("utf-8"))
            print(f"Loaded {len(all_questions)} existing questions from {out_path}")
        except Exception:
            pass
            
    with pdfplumber.open(filepath) as pdf:
        num_pages = len(pdf.pages)
        print(f"Reading {filepath} with {num_pages} pages")
        
        # We start from the beginning. To optimize, one would skip already processed pages, 
        # but for simplicity we'll just parse and append (ignoring exact deduplication for now, or you can implement logic)
        all_questions = [] # reset for clean run
        
        for i in range(0, num_pages, chunk_size):
            chunk_pages = pdf.pages[i : i+chunk_size]
            text = "\n\n".join(p.extract_text() or "" for p in chunk_pages)
            if len(text.strip()) < 50:
                print(f"Skipping pages {i} to {i+chunk_size-1} (empty)")
                continue
                
            print(f"[{subject_name}] Processing pages {i} to {i+chunk_size-1}...")
            start_t = time.time()
            questions = process_chunk(text)
            all_questions.extend(questions)
            
            # Save incrementally
            out_path.write_text(json.dumps(all_questions, indent=2), encoding="utf-8")
            
            elapsed = time.time() - start_t
            sleep_time = max(0, 31 - elapsed)  # ensure we don't hit 6k TPM limits too fast (wait 30s)
            print(f"Extracted {len(questions)} questions. Sleeping {sleep_time:.1f}s")
            time.sleep(sleep_time)
            
    print(f"Finished {subject_name}. Total: {len(all_questions)} questions.")

if __name__ == "__main__":
    extract_from_pdf("question_pdfs/MATHEMATICS-JAMB-Past-Questions.pdf", "mth")
    extract_from_pdf("question_pdfs/CHEMISTRY-JAMB-Past-Questions.pdf", "chm")
    extract_from_pdf("question_pdfs/Physics-JAMB-Past-Questions.pdf", "phy")
