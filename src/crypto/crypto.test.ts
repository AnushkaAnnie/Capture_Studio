import { describe, it, expect } from "vitest";
import {
  generateEcdsaKeyPair,
  exportPublicKeyJwk,
  importPublicKeyJwk,
} from "./keys";
import {
  sha256String,
  sha256Blob,
} from "./hash";
import {
  createCanonicalPayload,
  signCanonicalPayload,
  verifyCanonicalPayload,
} from "./sign";
import {
  createGenesisRecord,
  appendChainedRecord,
  verifyManifestChain,
} from "./chain";
import type { Manifest } from "../types/manifest";

describe("TrueCapture Cryptographic Primitives", () => {
  it("generates an ECDSA P-256 keypair, exports to JWK, and imports successfully", async () => {
    const keyPair = await generateEcdsaKeyPair();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();

    const jwk = await exportPublicKeyJwk(keyPair.publicKey);
    expect(jwk.kty).toBe("EC");
    expect(jwk.crv).toBe("P-256");
    expect(jwk.x).toBeDefined();
    expect(jwk.y).toBeDefined();

    const imported = await importPublicKeyJwk(jwk);
    expect(imported).toBeDefined();
    expect(imported.algorithm.name).toBe("ECDSA");
  });

  it("hashes data using SHA-256 correctly", async () => {
    const hash = await sha256String("hello world");
    // Standard SHA-256 of "hello world"
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");

    const blob = new Blob(["hello world"], { type: "text/plain" });
    const blobHash = await sha256Blob(blob);
    expect(blobHash).toBe(hash);
  });

  it("signs and verifies canonical payload string", async () => {
    const keyPair = await generateEcdsaKeyPair();
    const payload = createCanonicalPayload({
      contentHash: "abcdef123456",
      previousRecordHash: "GENESIS",
      timestamp: 1700000000000,
      action: "capture",
    });

    const signature = await signCanonicalPayload(payload, keyPair.privateKey);
    expect(typeof signature).toBe("string");
    expect(signature.length).toBeGreaterThan(20);

    const isValid = await verifyCanonicalPayload(payload, signature, keyPair.publicKey);
    expect(isValid).toBe(true);

    // Tampered payload fails verification
    const tamperedPayload = payload + "_modified";
    const isTamperedValid = await verifyCanonicalPayload(
      tamperedPayload,
      signature,
      keyPair.publicKey
    );
    expect(isTamperedValid).toBe(false);
  });

  it("creates a 3-step chain and verifies untampered chain of custody", async () => {
    const keyPair = await generateEcdsaKeyPair();
    const genesisBlob = new Blob(["initial-image-pixels"], { type: "image/png" });
    const grayscaleBlob = new Blob(["grayscale-image-pixels"], { type: "image/png" });
    const exportBlob = new Blob(["grayscale-image-pixels"], { type: "image/png" });

    // Step 1: Genesis capture
    const { record: genesisRec } = await createGenesisRecord(genesisBlob, keyPair);
    expect(genesisRec.previousRecordHash).toBeNull();
    expect(genesisRec.action).toBe("capture");

    // Step 2: Grayscale edit
    const { record: editRec } = await appendChainedRecord(
      genesisRec,
      grayscaleBlob,
      "grayscale",
      keyPair
    );
    expect(editRec.previousRecordHash).not.toBeNull();
    expect(editRec.action).toBe("grayscale");

    // Step 3: Export
    const { record: exportRec } = await appendChainedRecord(
      editRec,
      exportBlob,
      "export",
      keyPair
    );
    expect(exportRec.previousRecordHash).not.toBeNull();
    expect(exportRec.action).toBe("export");

    const manifest: Manifest = {
      version: "1.0",
      chain: [genesisRec, editRec, exportRec],
    };

    // Untampered verification
    const report = await verifyManifestChain(manifest, exportBlob);
    expect(report.overallValid).toBe(true);
    expect(report.chainLength).toBe(3);
    expect(report.steps.every((s) => s.status === "valid")).toBe(true);
  });

  it("detects tampered final image bytes", async () => {
    const keyPair = await generateEcdsaKeyPair();
    const genesisBlob = new Blob(["initial-image-pixels"], { type: "image/png" });
    const { record: genesisRec } = await createGenesisRecord(genesisBlob, keyPair);

    const manifest: Manifest = {
      version: "1.0",
      chain: [genesisRec],
    };

    const tamperedBlob = new Blob(["maliciously-altered-pixels"], { type: "image/png" });
    const report = await verifyManifestChain(manifest, tamperedBlob);

    expect(report.overallValid).toBe(false);
    expect(report.steps[0].status).toBe("invalid_hash");
    expect(report.steps[0].failureReason).toContain("Image content hash mismatch");
  });

  it("detects broken chain link if an intermediate record is swapped or altered", async () => {
    const keyPair = await generateEcdsaKeyPair();
    const genesisBlob = new Blob(["initial"], { type: "image/png" });
    const editBlob = new Blob(["edited"], { type: "image/png" });

    const { record: genesisRec } = await createGenesisRecord(genesisBlob, keyPair);
    const { record: editRec } = await appendChainedRecord(genesisRec, editBlob, "crop", keyPair);

    // Tamper with previousRecordHash
    const tamperedEditRec = {
      ...editRec,
      previousRecordHash: "0000000000000000000000000000000000000000000000000000000000000000",
    };

    const manifest: Manifest = {
      version: "1.0",
      chain: [genesisRec, tamperedEditRec],
    };

    const report = await verifyManifestChain(manifest, editBlob);
    expect(report.overallValid).toBe(false);
    expect(report.steps[1].status).toBe("broken_chain");
  });
});
