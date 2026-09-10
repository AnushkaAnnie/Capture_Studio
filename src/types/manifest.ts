/**
 * Content Authenticity & Proof-of-Freshness Data Model (TrueCapture)
 * Compatible with C2PA / Content Credentials proof-of-concept requirements.
 */

export interface CaptureRecord {
  /** Unique identifier (UUID v4) for this record */
  recordId: string;
  /** SHA-256 hash of the previous record in the chain; null for genesis */
  previousRecordHash: string | null;
  /** SHA-256 hex digest of the raw image bytes at this step */
  contentHash: string;
  /** Capture or modification timestamp in Unix milliseconds (Date.now()) */
  timestamp: number;
  /** Action performed to produce this record */
  action: "capture" | "crop" | "grayscale" | "export";
  /** Exported public key in JWK format used for ECDSA P-256 signature verification */
  publicKeyJwk: JsonWebKey;
  /** Base64-encoded ECDSA P-256 signature over the canonical payload string */
  signature: string;
}

export interface Manifest {
  /** Specification version */
  version: "1.0";
  /** Ordered list of capture and edit records forming an unbroken chain-of-custody */
  chain: CaptureRecord[];
}

export type StepVerificationStatus = "valid" | "invalid_hash" | "invalid_signature" | "broken_chain";

export interface StepVerificationDetail {
  stepIndex: number;
  recordId: string;
  action: CaptureRecord["action"];
  timestamp: number;
  contentHash: string;
  previousRecordHash: string | null;
  expectedPreviousRecordHash: string | null;
  status: StepVerificationStatus;
  isSignatureValid: boolean;
  isChainLinkValid: boolean;
  isContentHashValid?: boolean; // Evaluated for the leaf/exported image
  failureReason?: string;
}

export interface VerificationReportData {
  overallValid: boolean;
  summary: string;
  finalImageHash: string;
  manifestFinalHash: string;
  chainLength: number;
  steps: StepVerificationDetail[];
}
