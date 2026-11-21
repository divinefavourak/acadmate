# Question pipeline

Turns past-question PDFs, booklet photos and the JSON files in this repo into import-ready, answer-checked questions with explanations. The output goes to `/admin/imports`.

- **Claude Sonnet 5.5** does the bulk work: it extracts questions, solves and explains them, and generates practice questions.
- **Claude Opus 5.5** is the judge. It only sees questions where Sonnet disagrees with the booklet's answer, questions with no printed answer, and every AI-generated question.
- **Everything runs through the Message Batches API** at half price, with a hard spend cap.

## Setup (once)

1. Install the dependencies: `npm install` at the repo root. `pdf-lib` and `@anthropic-ai/sdk` are already listed.
2. Install Python 3 with `pypdfium2` and `Pillow`, which crop figures: `pip install pypdfium2 pillow`
3. Install Google Chrome, which renders tables and diagrams. If it isn't in the default location, set `CHROME` to its path.
4. Set your API key (PowerShell): `$env:ANTHROPIC_API_KEY="sk-ant-..."`

## First run: pilot (about $1)

```powershell
node content/pipeline/run.mjs pilot
```

This runs a slice of every stage and prints the real cost per accepted question. Open `content/pipeline/dist/*.json` and check about 20 answers and explanations, plus any figures, before you scale up.

## Full run: one wave per subject group

`wave` runs extract → solve → verify → emit for the subjects you name. It caps extraction at half of the remaining budget, so there's always money left to solve what was extracted. Run the waves in priority order. If the budget runs out, whatever is left stays queued, and a top-up later continues from there.

```powershell
node content/pipeline/run.mjs wave --subjects MTH,GEO,GEN       # Maths booklet + Geography/General Knowledge files
node content/pipeline/run.mjs wave --subjects BIO,CHM,PHY
node content/pipeline/run.mjs wave --subjects ENG               # 694 pages; add --pages 480-694 to do part of it first
node content/pipeline/run.mjs wave --subjects ECO,LIT,CRK,COM,ACC
node content/pipeline/run.mjs wave --subjects GOV
node content/pipeline/run.mjs status                            # counts per subject, spend, anything in flight
```

**How answers are decided:**
- **The booklet and Sonnet agree:** accepted.
- **They disagree:** Opus decides.
- **No printed answer** (Physics, Chemistry, CRK, Commerce and Accounts booklets have none): Opus decides. This is the default policy, `opus`.
  - To spend less, use `--keyless sonnet-unless-low` (accept Sonnet unless it rated itself low-confidence) or `--keyless sonnet` (always accept Sonnet).
  - If a key printed later in the booklet contradicts a Sonnet-only answer, that question goes back to Opus automatically.
- **Effort:** Opus reviews at `medium`. Sonnet solves at `medium` for MTH, PHY, CHM, ACC and ECO, and at `low` for the rest. Both are set in `config.mjs`.

**Budget:** `--budget` defaults to `24`. After topping up your credits, raise it, e.g. `--budget 50`. Spend is tracked cumulatively in `state/spend.json`.

**Solve waits for each PDF to be fully extracted.** Answer keys sit at the end of each paper, so this keeps questions from going to Opus just because their key hadn't been read yet.

**Optional, when there's budget:** `generate --min-per-topic 15` writes AI practice questions for thin topics, then `verify` has Opus check every one.

**Batches usually finish within an hour.** A stage waits and polls by default.
- With `--no-wait`, it submits and exits. Running the same stage again collects the results.
- If you stop a run with Ctrl-C, run it again: it picks up the batches already submitted and never pays twice.
- Add `--dry-run` to see the request count and estimated cost without submitting.

**Budget.** `--budget 24` (the default) is the total cap across all runs. The ledger is kept in `state/spend.json`.

## New booklets later (photos)

Use the same pipeline for new booklets, Post-UTME or UTME:

```powershell
node content/pipeline/run.mjs photos --dir ./booklets/unilag-2024 --school UNILAG --year 2024
node content/pipeline/run.mjs status                          # shows the source key, e.g. ph-1a2b3c4d5e
node content/pipeline/run.mjs extract --source ph-1a2b3c4d5e
node content/pipeline/run.mjs solve
node content/pipeline/run.mjs verify
node content/pipeline/run.mjs emit
```

Photo tips:
- Shoot flat from directly above, in good light.
- Keep each figure fully in frame.
- Name the files in page order (`page1.jpg`, `page2.jpg`, …). Sorting is numeric, so `page10` comes after `page9`.
- Phone rotation is fixed automatically.

## Figures

| Figure | What happens |
|---|---|
| Table | Claude transcribes it to HTML, and headless Chrome renders it to a PNG |
| Graph, geometry, circuit, ray diagram, apparatus, structure | Claude redraws it as SVG, rendered to a PNG |
| Specimen, photo, map, detailed drawing | Cropped from the page or photo at full resolution |
| Unclear (blur, glare, cut off) | The question goes to a `needs-attention-*.json` file and imports as a **flagged draft** |

Images are embedded as base64. The importer uploads them to Cloudinary.

## Importing

- Upload each `dist/*.json` at **/admin/imports**.
  - `jamb-*` files: UTME mode.
  - `postutme-<school>-*` files: Post-UTME mode, with that school selected.
  - `postutme-choose-school-*` files: Post-UTME mode, with the right school picked yourself.
- Re-importing is safe, because duplicates are skipped.
- Questions land as drafts. Spot-check them in the Question Builder, then use **Publish** on the import.
- Flagged drafts are never bulk-published. Fix each one (attach the image, set the answer), then publish it individually.
- `*-practice.json` files hold AI-generated questions. They're marked `AI_ASSISTED`, used for in-app practice, and never shown as past papers.

## Files

- `state/` holds paid work: rows, extract results, batch ids, the spend ledger. **Back it up and don't delete it.** It's gitignored because it holds base64 images.
- `dist/` holds the import files, rebuilt by `emit`.
