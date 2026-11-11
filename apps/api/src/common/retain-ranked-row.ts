/** Keeps the worst retained row at the root so a better row can replace it. */
export function retainRankedRow<Row>(
  heap: Row[],
  row: Row,
  capacity: number,
  compare: (left: Row, right: Row) => number,
) {
  if (capacity <= 0) return;
  if (heap.length < capacity) {
    let index = heap.length;
    heap.push(row);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compare(heap[parent]!, row) >= 0) break;
      heap[index] = heap[parent]!;
      index = parent;
    }
    heap[index] = row;
    return;
  }
  if (compare(row, heap[0]!) >= 0) return;
  let index = 0;
  while (2 * index + 1 < heap.length) {
    let child = 2 * index + 1;
    if (child + 1 < heap.length && compare(heap[child + 1]!, heap[child]!) > 0)
      child++;
    if (compare(row, heap[child]!) >= 0) break;
    heap[index] = heap[child]!;
    index = child;
  }
  heap[index] = row;
}
