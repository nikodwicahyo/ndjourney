/**
 * Single ownership rule for rows that may predate couple scoping.
 *
 * - couple-scoped row -> only that couple
 * - orphan (coupleId null) -> only its creator/uploader
 *
 * Never treat an orphan row as shared with every authenticated user. Kept in a
 * dependency-free module so it is trivially testable and safe to import from
 * both route handlers and query helpers.
 */
export type CoupleOwnedRow = {
  coupleId: string | null;
  createdById?: string | null;
  uploadedById?: string | null;
};

export function canManageCoupleRow(
  row: CoupleOwnedRow,
  coupleId: string | null,
  userId: string,
): boolean {
  if (row.coupleId !== null) return row.coupleId === coupleId;
  const ownerId = row.createdById ?? row.uploadedById ?? null;
  return ownerId !== null && ownerId === userId;
}
