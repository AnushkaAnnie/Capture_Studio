/**
 * ECDSA P-256 Signing and Verification using native Web Crypto API.
 *
 * CANONICAL PAYLOAD SPECIFICATION:
 * To ensure deterministic signature generation and verification across any client or environment,
 * the signed payload string is constructed by concatenating exactly four fields with vertical bar delimiters:
 *
 *   `${contentHash}|${previousRecordHash ?? "GENESIS"}|${timestamp}|${action}`
 *
 * Fields included:
 *  - contentHash: SHA-256 hex string of the image bytes at this stage
 *  - previousRecordHash: SHA-256 hex string of previous record (or literal "GENESIS" for the root)
 *  - timestamp: Unix epoch timestamp in milliseconds (Date.now())
 *  - action: "capture" | "crop" | "grayscale" | "export"
 */

import { base64ToBuffer, bufferToBase64 } from "./hash";

const getCryptoSubtle = (): SubtleCrypto => {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error("Web Crypto API (crypto.subtle) is not supported in this environment.");
};

export interface CanonicalPayloadInput {
  contentHash: string;
  previousRecordHash: string | null;
  timestamp: number;
  action: string;
}

/**
 * Serializes the record attributes into the exact byte-for-byte canonical string to sign.
 */
export function createCanonicalPayload(input: CanonicalPayloadInput): string {
  const prev = input.previousRecordHash ?? "GENESIS";
  return `${input.contentHash}|${prev}|${input.timestamp}|${input.action}`;
}

/**
 * Signs a canonical payload string using ECDSA P-256 with SHA-256.
 * Returns Base64-encoded signature string.
 */
export async function signCanonicalPayload(
  payload: string,
  privateKey: CryptoKey
): Promise<string> {
  const subtle = getCryptoSubtle();
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);

  const signatureBuffer = await subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" },
    },
    privateKey,
    data
  );

  return bufferToBase64(signatureBuffer);
}

/**
 * Verifies a Base64-encoded ECDSA P-256 signature against the canonical payload string.
 */
export async function verifyCanonicalPayload(
  payload: string,
  signatureBase64: string,
  publicKey: CryptoKey
): Promise<boolean> {
  const subtle = getCryptoSubtle();
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);

  try {
    const signatureBuffer = base64ToBuffer(signatureBase64);
    return await subtle.verify(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" },
      },
      publicKey,
      signatureBuffer,
      data
    );
  } catch (error) {
    console.warn("Signature verification exception:", error);
    return false;
  }
}
