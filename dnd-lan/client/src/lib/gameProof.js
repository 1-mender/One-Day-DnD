function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

async function hmacHex(secret, message) {
  const encoder = new TextEncoder();
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(String(secret || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(String(message || "")));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function makeProof(seed, proof, payload) {
  const body = `${seed || ""}:${JSON.stringify(payload || {})}`;
  if (!window.crypto?.subtle) {
    return Promise.resolve(simpleHash(`${proof || ""}:${body}`));
  }
  return hmacHex(proof, body);
}
