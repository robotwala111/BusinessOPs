export function generateId(prefix = "AMT") {
  return `${prefix}-${crypto.randomUUID()}`;
}
