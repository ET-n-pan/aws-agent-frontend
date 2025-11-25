export function createRuntimeSessionId() {
  // Must be 33+ chars
  return "web-" + crypto.randomUUID().replace(/-/g, "").padEnd(33, "x");
}
