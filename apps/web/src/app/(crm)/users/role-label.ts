/** Presentation only: canonical role names/IDs still drive assignment and authorization. */
export function roleLabel(name: string): string {
  return name.replace(/(دسترسی\s+کامل)\s+demo(?=$|[\s،,؛;:()])/gi, '$1');
}
