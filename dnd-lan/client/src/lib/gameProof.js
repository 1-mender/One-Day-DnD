function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function makeProof(seed, payload) {
  const body = `${seed || ""}:${JSON.stringify(payload || {})}`;
  return simpleHash(body);
}
