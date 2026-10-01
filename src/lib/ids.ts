/** A random UUID made on this device, so records can be created offline. */
export function newId(): string {
  return crypto.randomUUID()
}
