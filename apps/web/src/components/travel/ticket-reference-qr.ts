/** QR version 3-L, byte mode, mask 0. Encodes only the printed booking reference. */
export function ticketReferenceQr(value: string): string | null {
  const bytes = new TextEncoder().encode(value);
  if (!bytes.length || bytes.length > 53) return null;
  const bits: number[] = [];
  const append = (n: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((n >>> i) & 1);
  };
  append(4, 4);
  append(bytes.length, 8);
  for (const byte of bytes) append(byte, 8);
  append(0, Math.min(4, 440 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = Array.from({ length: bits.length / 8 }, (_, i) =>
    bits.slice(i * 8, i * 8 + 8).reduce((n, b) => (n << 1) | b, 0),
  );
  for (let i = 0; data.length < 55; i++) data.push(i % 2 ? 0x11 : 0xec);
  const mul = (a: number, b: number) => {
    let result = 0;
    for (let i = 7; i >= 0; i--) {
      result = (result << 1) ^ ((result >>> 7) * 0x11d);
      result ^= ((b >>> i) & 1) * a;
    }
    return result;
  };
  const divisor = Array<number>(15).fill(0);
  divisor[14] = 1;
  let root = 1;
  for (let i = 0; i < 15; i++) {
    for (let j = 0; j < 15; j++) {
      divisor[j] = mul(divisor[j]!, root) ^ (divisor[j + 1] ?? 0);
    }
    root = mul(root, 2);
  }
  const remainder = Array<number>(15).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder.shift()!;
    remainder.push(0);
    for (let i = 0; i < 15; i++)
      remainder[i] = remainder[i]! ^ mul(divisor[i]!, factor);
  }
  const stream = [...data, ...remainder].flatMap((byte) =>
    Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1),
  );
  const size = 29;
  const cells = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );
  const reserved = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );
  const set = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    cells[y]![x] = dark;
    reserved[y]![x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [25, 3],
    [3, 25],
  ]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx! + dx, cy! + dy, distance !== 2 && distance !== 4);
      }
  }
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      set(22 + dx, 22 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  const format = 0x77c4; // L + mask 0, BCH-protected and XOR-masked.
  const bit = (i: number) => ((format >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      const y = ((right + 1) & 2) === 0 ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset++) {
        const x = right - offset;
        if (!reserved[y]![x])
          cells[y]![x] = ((stream[index++] ?? 0) !== 0) !== ((x + y) % 2 === 0);
      }
    }
  }
  const path = cells
    .flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x + 4} ${y + 4}h1v1h-1z`] : [])),
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37" role="img" aria-label="Booking reference QR" shape-rendering="crispEdges"><rect width="37" height="37" fill="white"/><path d="${path}" fill="#102e52"/></svg>`;
}
