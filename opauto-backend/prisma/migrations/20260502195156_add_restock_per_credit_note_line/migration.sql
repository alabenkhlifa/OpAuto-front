-- S-EDGE-013 (Sweep C-23) — per-line credit-note restock toggle.
--
-- Adds a Boolean `restockPart` flag to `credit_note_line_items` (default
-- true). The companion `credit_notes.restockParts` parent field is kept
-- as a "default for new lines" + aggregate-style flag for legacy reads
-- (z-report, list badge); each line's own `restockPart` is the new
-- source of truth that the issue-time stock-restore logic consults.
--
-- Backfill rule: existing rows must replay identically under the new
-- per-line logic, so any line that belongs to a credit note whose
-- legacy parent `restockParts` is FALSE inherits `restockPart = false`.
-- Lines under a parent with `restockParts = true` keep the default
-- (true) — semantics unchanged.

-- AlterTable
ALTER TABLE "credit_note_line_items" ADD COLUMN     "restockPart" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: preserve legacy parent-level intent for existing rows.
UPDATE "credit_note_line_items" AS cnli
SET "restockPart" = false
FROM "credit_notes" AS cn
WHERE cnli."creditNoteId" = cn."id"
  AND cn."restockParts" = false;
