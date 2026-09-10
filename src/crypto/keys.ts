/**
 * ECDSA P-256 Key Management using native Web Crypto API.
 * Pure functions with zero external UI or third-party crypto dependencies.
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
 * Generates an ECDSA keypair using curve P-256 for signing and verification.
 * Private key is extractable to support session persistence or export if needed.
 */
export async function generateEcdsaKeyPair(): Promise<CryptoKeyPair> {
  const subtle = getCryptoSubtle();
  return subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true, // extractable
    ["sign", "verify"]
  );
}

/**
 * Exports a public CryptoKey into JSON Web Key (JWK) format.
 * This JWK can be embedded safely inside CaptureRecord.
 */
export async function exportPublicKeyJwk(publicKey: CryptoKey): Promise<JsonWebKey> {
  const subtle = getCryptoSubtle();
  return subtle.exportKey("jwk", publicKey);
}

/**
 * Imports a public key from JWK format for ECDSA verification.
 */
export async function importPublicKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  const subtle = getCryptoSubtle();
  return subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true, // extractable
    ["verify"]
  );
}

/**
 * Exports a private CryptoKey into JWK format.
 */
export async function exportPrivateKeyJwk(privateKey: CryptoKey): Promise<JsonWebKey> {
  const subtle = getCryptoSubtle();
  return subtle.exportKey("jwk", privateKey);
}

/**
 * Imports a private key from JWK format for ECDSA signing.
 */
export async function importPrivateKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  const subtle = getCryptoSubtle();
  return subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true, // extractable
    ["sign"]
  );
}
