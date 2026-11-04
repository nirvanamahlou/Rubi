import type { EditorSchema } from './api/client';

export function resolveSchema(
  node: EditorSchema,
  root: EditorSchema,
): EditorSchema {
  if (node.$ref)
    return resolveSchema(
      root.$defs?.[node.$ref.split('/').at(-1)!] ?? {},
      root,
    );
  if (node.anyOf) {
    const value = node.anyOf.find((n) => n.type !== 'null') ?? {};
    return {
      ...resolveSchema(value, root),
      ...(node.title ? { title: node.title } : {}),
      ...(node.description ? { description: node.description } : {}),
    };
  }
  return node;
}
export function nullable(node: EditorSchema) {
  return node.type === 'null' || !!node.anyOf?.some((n) => n.type === 'null');
}
export function decimalField(node: EditorSchema) {
  return (
    !!node.anyOf?.some((n) => n.type === 'number') &&
    !!node.anyOf?.some((n) => n.type === 'string')
  );
}
export function initialValue(node: EditorSchema, root: EditorSchema): unknown {
  if (node.default !== undefined) return structuredClone(node.default);
  const s = resolveSchema(node, root);
  if (s.default !== undefined) return structuredClone(s.default);
  if (s.type === 'object' || s.properties)
    return Object.fromEntries(
      Object.entries(s.properties ?? {})
        .map(([k, v]) => [k, initialValue(v, root)])
        .filter(([, v]) => v !== undefined),
    );
  if (s.type === 'array') return [];
  return undefined;
}
export function normaliseValue(
  node: EditorSchema,
  root: EditorSchema,
  value: unknown,
): unknown {
  const s = resolveSchema(node, root);
  if (value === null || value === undefined)
    return nullable(node) ? value : initialValue(node, root);
  if (Array.isArray(value))
    return value.map((v) => normaliseValue(s.items ?? {}, root, v));
  if (typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => Object.hasOwn(s.properties ?? {}, k))
        .map(([k, v]) => [k, normaliseValue(s.properties![k]!, root, v)]),
    );
  return value;
}
export function catalogueChanges(
  value: Record<string, unknown>,
  original: Record<string, unknown> | null,
) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([k, v]) =>
        v !== undefined &&
        (!original || JSON.stringify(original[k]) !== JSON.stringify(v)),
    ),
  );
}
