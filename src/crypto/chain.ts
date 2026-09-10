/**
 * Hash Chain Creation and Cryptographic Chain-of-Custody Verification.
 * Pure logic with no UI dependencies.
 */

import type {
  CaptureRecord,
  Manifest,
  StepVerificationDetail,
  VerificationReportData,
} from "../types/manifest";
import { sha256Blob, sha256String } from "./hash";
import { exportPublicKeyJwk, importPublicKeyJwk } from "./keys";
import {
  createCanonicalPayload,
  signCanonicalPayload,
  verifyCanonicalPayload,
} from "./sign";

/**
 * Computes a deterministic SHA-256 hash of a CaptureRecord.
 * This hash forms the cryptographic link to the subsequent record in the chain.
 */
export async function computeRecordHash(record: CaptureRecord): Promise<string> {
  const prev = record.previousRecordHash ?? "GENESIS";
  const canonical = `${record.recordId}:${record.contentHash}:${prev}:${record.timestamp}:${record.action}:${record.signature}`;
  return sha256String(canonical);
}

/**
 * Generates a pseudo-random UUID v4 compatible across browser and Node.
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates the genesis (first) CaptureRecord for a freshly captured or uploaded image.
 */
export async function createGenesisRecord(
  imageBlob: Blob,
  keyPair: CryptoKeyPair,
  customTimestamp?: number
): Promise<{ record: CaptureRecord; contentHash: string }> {
  const contentHash = await sha256Blob(imageBlob);
  const timestamp = customTimestamp ?? Date.now();
  const recordId = generateUUID();
  const action = "capture";
  const previousRecordHash = null;

  const payload = createCanonicalPayload({
    contentHash,
    previousRecordHash,
    timestamp,
    action,
  });

  const signature = await signCanonicalPayload(payload, keyPair.privateKey);
  const publicKeyJwk = await exportPublicKeyJwk(keyPair.publicKey);

  const record: CaptureRecord = {
    recordId,
    previousRecordHash,
    contentHash,
    timestamp,
    action,
    publicKeyJwk,
    signature,
  };

  return { record, contentHash };
}

/**
 * Appends an edit or export step to the hash chain, linked to the previous record.
 */
export async function appendChainedRecord(
  previousRecord: CaptureRecord,
  newImageBlob: Blob,
  action: "crop" | "grayscale" | "export",
  keyPair: CryptoKeyPair,
  customTimestamp?: number
): Promise<{ record: CaptureRecord; contentHash: string }> {
  const contentHash = await sha256Blob(newImageBlob);
  const previousRecordHash = await computeRecordHash(previousRecord);
  const timestamp = customTimestamp ?? Date.now();
  const recordId = generateUUID();

  const payload = createCanonicalPayload({
    contentHash,
    previousRecordHash,
    timestamp,
    action,
  });

  const signature = await signCanonicalPayload(payload, keyPair.privateKey);
  const publicKeyJwk = await exportPublicKeyJwk(keyPair.publicKey);

  const record: CaptureRecord = {
    recordId,
    previousRecordHash,
    contentHash,
    timestamp,
    action,
    publicKeyJwk,
    signature,
  };

  return { record, contentHash };
}

/**
 * Validates an entire Manifest chain, checking signatures, chain linkage, and optional image content match.
 */
export async function verifyManifestChain(
  manifest: Manifest,
  finalImageBlob?: Blob
): Promise<VerificationReportData> {
  const steps: StepVerificationDetail[] = [];
  let overallValid = true;
  let finalImageHash = "";

  if (finalImageBlob) {
    finalImageHash = await sha256Blob(finalImageBlob);
  }

  if (!manifest || !Array.isArray(manifest.chain) || manifest.chain.length === 0) {
    return {
      overallValid: false,
      summary: "Manifest contains no capture records.",
      finalImageHash,
      manifestFinalHash: "",
      chainLength: 0,
      steps: [],
    };
  }

  const chain = manifest.chain;
  const leafRecord = chain[chain.length - 1];
  const manifestFinalHash = leafRecord.contentHash;

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    let isChainLinkValid = true;
    let expectedPreviousRecordHash: string | null = null;
    let failureReason: string | undefined;

    // 1. Verify chain link
    if (i === 0) {
      if (current.previousRecordHash !== null) {
        isChainLinkValid = false;
        failureReason = "Genesis record must have previousRecordHash set to null.";
      }
    } else {
      expectedPreviousRecordHash = await computeRecordHash(chain[i - 1]);
      if (current.previousRecordHash !== expectedPreviousRecordHash) {
        isChainLinkValid = false;
        failureReason = `Broken chain link at step ${i + 1}: previousRecordHash does not match computed hash of step ${i}.`;
      }
    }

    // 2. Verify ECDSA signature
    let isSignatureValid = false;
    try {
      const publicKey = await importPublicKeyJwk(current.publicKeyJwk);
      const canonicalPayload = createCanonicalPayload({
        contentHash: current.contentHash,
        previousRecordHash: current.previousRecordHash,
        timestamp: current.timestamp,
        action: current.action,
      });
      isSignatureValid = await verifyCanonicalPayload(
        canonicalPayload,
        current.signature,
        publicKey
      );
      if (!isSignatureValid && !failureReason) {
        failureReason = `Cryptographic signature mismatch at step ${i + 1} (${current.action}). Payload or key was altered.`;
      }
    } catch (err: unknown) {
      isSignatureValid = false;
      failureReason = `Invalid public key JWK or signature format at step ${i + 1}: ${err instanceof Error ? err.message : String(err)}`;
    }

    // 3. For the leaf record, optionally verify against final image bytes
    let isContentHashValid: boolean | undefined;
    if (i === chain.length - 1 && finalImageHash) {
      isContentHashValid = finalImageHash.toLowerCase() === current.contentHash.toLowerCase();
      if (!isContentHashValid) {
        failureReason = `Image content hash mismatch: Loaded image hash (${finalImageHash.substring(0, 16)}...) does not match final recorded hash (${current.contentHash.substring(0, 16)}...). Image bytes were modified post-export.`;
      }
    }

    let status: StepVerificationDetail["status"] = "valid";
    if (!isChainLinkValid) {
      status = "broken_chain";
      overallValid = false;
    } else if (!isSignatureValid) {
      status = "invalid_signature";
      overallValid = false;
    } else if (isContentHashValid === false) {
      status = "invalid_hash";
      overallValid = false;
    }

    steps.push({
      stepIndex: i + 1,
      recordId: current.recordId,
      action: current.action,
      timestamp: current.timestamp,
      contentHash: current.contentHash,
      previousRecordHash: current.previousRecordHash,
      expectedPreviousRecordHash,
      status,
      isSignatureValid,
      isChainLinkValid,
      isContentHashValid,
      failureReason,
    });
  }

  let summary = overallValid
    ? `Chain intact: All ${chain.length} cryptographic steps and signatures verified successfully.`
    : `Verification failed: One or more records failed hash, signature, or link validation.`;

  return {
    overallValid,
    summary,
    finalImageHash,
    manifestFinalHash,
    chainLength: chain.length,
    steps,
  };
}
