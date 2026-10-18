import type {
  PackageTourCostGridV1,
  PackageTourHotelPurchaseBatchV1,
} from './index';
/** Retain a real draft anchor FK while each selected row retains its actual source batch FK. */
export function packageTourSelectionBatch(
  grid: PackageTourCostGridV1,
  batchId: string,
  allMatching = true,
): PackageTourHotelPurchaseBatchV1 | undefined {
  const anchor = grid.purchaseBatches.find((b) => b.id === batchId);
  if (!anchor || !allMatching) return anchor;
  const rows = new Map(
    grid.purchaseBatches
      .filter((b) => b.branchId === anchor.branchId)
      .flatMap((b) => b.rows.map((row) => [row.id, row] as const)),
  );
  return { ...anchor, rows: [...rows.values()] };
}
