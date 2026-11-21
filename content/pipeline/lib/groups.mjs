// custom_id is capped at 64 chars, so the row ids behind each multi-question request live in state/groups.json.
import { inFlight } from './batch.mjs';
import { readJson, writeJson } from './state.mjs';
import { shortHash } from './util.mjs';

export const groupId = (prefix, rows) => `${prefix}_${shortHash(rows.map((r) => r.id).join(','))}`;

export function rememberGroups(requests) {
  const groups = readJson('groups.json', {});
  for (const r of requests) groups[r.custom_id] = r.rowIds;
  writeJson('groups.json', groups);
}

export const groupRows = (customId) => readJson('groups.json', {})[customId] ?? [];

/** Row ids currently inside a submitted, not-yet-ingested batch of `stage`. */
export function rowsInFlight(stage) {
  const groups = readJson('groups.json', {});
  return new Set([...inFlight(stage)].flatMap((id) => groups[id] ?? []));
}

/** Map a result's local label ("q3") back to its row id. */
export const rowIdFor = (customId, label) => groupRows(customId)[Number(String(label).replace(/^q/, '')) - 1];
