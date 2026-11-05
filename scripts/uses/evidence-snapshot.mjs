/**
 * Goal & Constraints:
 * Freeze classifier inputs so every model sees the same evidence. The
 * observation time is stored for provenance and left out of the snapshot id.
 */

import { createHash } from "node:crypto";

/**
 * @param {object} record
 * @returns {object}
 */
export function semanticEvidence(record) {
  const copy = { ...record };
  delete copy.observed_at;
  return copy;
}

/**
 * @param {object[]} records
 * @returns {{ snapshot_id: string, records: object[] }}
 */
export function freezeEvidenceSnapshot(records) {
  const frozen = (Array.isArray(records) ? records : [])
    .map((record) => semanticEvidence(record || {}))
    .sort((left, right) =>
      String(left.evidence_id || "").localeCompare(
        String(right.evidence_id || ""),
      ),
    );
  const snapshotId = createHash("sha256")
    .update(JSON.stringify(frozen))
    .digest("hex")
    .slice(0, 16);
  return { snapshot_id: snapshotId, records: frozen };
}
