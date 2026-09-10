/**
 * SHA-256 Hashing and encoding helpers using native Web Crypto API.
 * Pure functions with no external UI or third-party crypto dependencies.
 */

const getCryptoSubtle = (): SubtleCrypto => {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error("Web Crypto API (crypto.subtle) is not supported in this environment.");
};

/**
 * Converts an ArrayBuffer to a lowercase hexadecimal string.
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexCodes: string[] = new Array(byteArray.length);
  for (let i = 0; i < byteArray.length; i++) {
    hexCodes[i] = byteArray[i].toString(16).padStart(2, "0");
  }
  return hexCodes.join("");
}

/**
 * Converts an ArrayBuffer to a Base64 string.
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string back to an ArrayBuffer.
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Computes SHA-256 digest of an ArrayBuffer, returning a hex string.
 */
export async function sha256Buffer(data: ArrayBuffer): Promise<string> {
  const subtle = getCryptoSubtle();
  const hashBuffer = await subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

/**
 * Computes SHA-256 digest of a UTF-8 string, returning a hex string.
 */
export async function sha256String(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return sha256Buffer(data.buffer);
}

/**
 * Computes SHA-256 digest of a Blob / File, returning a hex string.
 */
export async function sha256Blob(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  return sha256Buffer(arrayBuffer);
}
