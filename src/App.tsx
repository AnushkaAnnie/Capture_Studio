import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Camera,
  Download,
  ArrowRight,
  RotateCcw,
  Sparkles,
  SearchCheck,
  Fingerprint,
  FileJson,
  Image as ImageIcon,
  Copy,
  Check,
} from "lucide-react";
import type { Manifest, CaptureRecord, VerificationReportData } from "./types/manifest";
import { generateEcdsaKeyPair, exportPublicKeyJwk } from "./crypto/keys";
import { createGenesisRecord, appendChainedRecord, verifyManifestChain } from "./crypto/chain";
import { CaptureView } from "./capture/CaptureView";
import { EditPanel } from "./capture/EditPanel";
import { VerifierDropzone } from "./verify/VerifierDropzone";
import { VerificationReport } from "./verify/VerificationReport";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/** Checks if running inside an iframe / sandboxed frame where showSaveFilePicker throws SecurityError */
const isSandboxedIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"capture" | "verify">("capture");

  // Crypto Session State
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [publicKeyJwk, setPublicKeyJwk] = useState<JsonWebKey | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Capture & Chain Studio State
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Manifest>({ version: "1.0", chain: [] });
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Verifier State
  const [verificationReport, setVerificationReport] = useState<VerificationReportData | null>(null);
  const [targetImageName, setTargetImageName] = useState<string | undefined>(undefined);
  const [isVerifying, setIsVerifying] = useState(false);

  // Initialize session ECDSA keypair
  useEffect(() => {
    async function initKeys() {
      try {
        const kp = await generateEcdsaKeyPair();
        const jwk = await exportPublicKeyJwk(kp.publicKey);
        setKeyPair(kp);
        setPublicKeyJwk(jwk);
      } catch (err) {
        console.error("Failed to generate session ECDSA keypair:", err);
      } finally {
        setIsInitializing(false);
      }
    }
    initKeys();
  }, []);

  // ─── Professional Download Engine ──────────────────────────────────────────
  /** Low-level anchor-based file download: clicks immediately and revokes on next tick */
  const downloadWithAnchor = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);

    a.click();

    // Revoke on next tick so the browser starts the download stream cleanly
    setTimeout(() => {
      URL.revokeObjectURL(url);
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 0);
  };

  /** Primary download: opens native Save-As dialog (guaranteed correct name on all OS).
   *  Falls back to anchor download if File System Access API is unavailable or in a sandboxed iframe. */
  const triggerSafeDownload = async (blob: Blob, filename: string): Promise<void> => {
    // Primary: File System Access API — skip if running inside a sandboxed/cross-origin iframe where it throws SecurityError
    if (!isSandboxedIframe() && "showSaveFilePicker" in window) {
      try {
        const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
        const mimeType = blob.type.split(";")[0].trim() || "application/octet-stream";

        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: ext === "json" ? "JSON Manifest" : "Signed Image",
              accept: { [mimeType]: ["." + ext] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return; // done — OS saved with the exact filename
      } catch (err: any) {
        if (err.name === "AbortError") return; // user cancelled — do not fall back
        console.warn("[Download] showSaveFilePicker failed, falling back to anchor:", err?.message || err);
      }
    }

    // Fallback: immediate anchor click with next-tick revocation
    downloadWithAnchor(blob, filename);
  };

  // Flow 1: Capture & Sign Genesis Record
  const handleCaptureComplete = async (capturedBlob: Blob, capturedPreviewUrl: string) => {
    if (!keyPair) return;
    setIsProcessing(true);
    try {
      const { record } = await createGenesisRecord(capturedBlob, keyPair);
      setImageBlob(capturedBlob);
      setPreviewUrl(capturedPreviewUrl);
      setManifest({
        version: "1.0",
        chain: [record],
      });
    } catch (err) {
      console.error("Failed to sign genesis capture:", err);
      alert("Error generating cryptographic genesis record.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Flow 2: Edit & Hash Chain Appending
  const handleApplyEdit = async (
    newBlob: Blob,
    newPreviewUrl: string,
    action: "grayscale" | "crop"
  ) => {
    if (!keyPair || manifest.chain.length === 0) return;
    setIsProcessing(true);
    try {
      const previousRecord = manifest.chain[manifest.chain.length - 1];
      const { record } = await appendChainedRecord(previousRecord, newBlob, action, keyPair);
      setImageBlob(newBlob);
      setPreviewUrl(newPreviewUrl);
      setManifest((prev) => ({
        ...prev,
        chain: [...prev.chain, record],
      }));
    } catch (err) {
      console.error("Failed to chain edit record:", err);
      alert("Error appending record to hash chain.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Flow 3: Export individual files and bundle
  const getImageFilename = (): string => {
    if (!imageBlob) return "truecapture-final.png";
    const mime = imageBlob.type ? imageBlob.type.split(";")[0].trim().toLowerCase() : "";
    const ext = (mime && MIME_TO_EXT[mime]) || "png";
    return `truecapture-final.${ext}`;
  };

  const handleExportImage = async () => {
    if (!imageBlob) return;
    try {
      await triggerSafeDownload(imageBlob, getImageFilename());
    } catch (err) {
      console.error("Failed to export image:", err);
      alert("Failed to download image. Please try again.");
    }
  };

  const handleExportManifest = async () => {
    if (manifest.chain.length === 0) return;
    try {
      const manifestJsonString = JSON.stringify(manifest, null, 2);
      const manifestBlob = new Blob([manifestJsonString], {
        type: "application/json;charset=utf-8",
      });
      await triggerSafeDownload(manifestBlob, "manifest.json");
    } catch (err) {
      console.error("Failed to export manifest:", err);
      alert("Failed to download manifest. Please try again.");
    }
  };

  const handleCopyManifest = async () => {
    if (manifest.chain.length === 0) return;
    try {
      const manifestJsonString = JSON.stringify(manifest, null, 2);
      await navigator.clipboard.writeText(manifestJsonString);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (err) {
      console.error("Failed to copy manifest:", err);
      alert("Failed to copy manifest to clipboard.");
    }
  };

  const handleExportAll = async () => {
    if (!imageBlob || manifest.chain.length === 0) return;

    try {
      // Bundle download: use anchor pattern directly (avoids double OS Save dialogs)
      // Image first, manifest after 800 ms so browsers don't block simultaneous downloads
      downloadWithAnchor(imageBlob, getImageFilename());

      await new Promise((resolve) => setTimeout(resolve, 800));

      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      downloadWithAnchor(manifestBlob, "manifest.json");
    } catch (err) {
      console.error("Failed to export bundle:", err);
      alert("Failed to download files. Please try again.");
    }
  };

  // Quick link to send studio data directly to verifier
  const handleSendToVerifier = async () => {
    if (!imageBlob || manifest.chain.length === 0) return;
    setIsVerifying(true);
    setActiveTab("verify");
    try {
      const report = await verifyManifestChain(manifest, imageBlob);
      setVerificationReport(report);
      setTargetImageName("truecapture-final.png (Current Session)");
    } finally {
      setIsVerifying(false);
    }
  };

  // Flow 4: Verifier Execution
  const handleVerifyDrop = async (targetBlob: Blob, targetManifest: Manifest, fileName?: string) => {
    setIsVerifying(true);
    try {
      const report = await verifyManifestChain(targetManifest, targetBlob);
      setVerificationReport(report);
      setTargetImageName(fileName);
    } catch (err) {
      console.error("Verification execution error:", err);
      alert("Failed to complete cryptographic verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Flow 9: Tamper Simulation Demos
  const handleSimulateTamper = async (mode: "image_byte" | "manifest_data") => {
    if (!imageBlob || manifest.chain.length === 0) {
      alert("Please capture an image in the Studio first before simulating tamper.");
      return;
    }

    setIsVerifying(true);
    try {
      if (mode === "image_byte") {
        // Alter 1 byte in the image buffer
        const buffer = await imageBlob.arrayBuffer();
        const mutatedBytes = new Uint8Array(buffer.slice(0));
        // Flip bits in the middle of the file
        const offset = Math.floor(mutatedBytes.length / 2);
        mutatedBytes[offset] = mutatedBytes[offset] ^ 0xff;
        const tamperedBlob = new Blob([mutatedBytes], { type: imageBlob.type || "image/png" });

        const report = await verifyManifestChain(manifest, tamperedBlob);
        setVerificationReport(report);
        setTargetImageName("tampered-image.png [1 byte modified]");
      } else {
        // Alter manifest: modify signature of leaf record
        const leaf = manifest.chain[manifest.chain.length - 1];
        const tamperedLeaf: CaptureRecord = {
          ...leaf,
          signature: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=", // forged signature
        };
        const tamperedManifest: Manifest = {
          version: "1.0",
          chain: [...manifest.chain.slice(0, -1), tamperedLeaf],
        };

        const report = await verifyManifestChain(tamperedManifest, imageBlob);
        setVerificationReport(report);
        setTargetImageName("manifest.json [forged signature injected]");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetCapture = () => {
    setImageBlob(null);
    setPreviewUrl(null);
    setManifest({ version: "1.0", chain: [] });
  };

  const latestRecord =
    manifest.chain.length > 0 ? manifest.chain[manifest.chain.length - 1] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-gray-100 flex flex-col">
      {/* Top Navigation Header */}
      <header className="border-b border-gray-800/80 bg-gray-950/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black shadow-lg shadow-emerald-500/20">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">TrueCapture</h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  C2PA / ECDSA P-256
                </span>
              </div>
              <p className="text-xs text-gray-400">Content Authenticity & Proof-of-Freshness</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-gray-900 p-1 rounded-xl border border-gray-800 text-xs font-medium">
            <button
              onClick={() => setActiveTab("capture")}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "capture"
                  ? "bg-emerald-500 text-black font-semibold shadow-md shadow-emerald-500/20"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture & Studio</span>
            </button>

            <button
              onClick={() => setActiveTab("verify")}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "verify"
                  ? "bg-emerald-500 text-black font-semibold shadow-md shadow-emerald-500/20"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <SearchCheck className="w-3.5 h-3.5" />
              <span>Audit & Verifier</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col items-center">
        {isInitializing ? (
          <div className="my-auto flex flex-col items-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono">Initializing Web Crypto ECDSA Session...</p>
          </div>
        ) : activeTab === "capture" ? (
          /* TAB 1: CAPTURE & CHAIN STUDIO */
          <div className="w-full flex flex-col items-center gap-8">
            {/* Session Security Banner */}
            <div className="w-full max-w-xl flex items-center justify-between p-3 rounded-xl bg-gray-900/50 border border-gray-800 text-xs font-mono">
              <div className="flex items-center gap-2 text-gray-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Session Key:</span>
                <span className="text-gray-300 truncate max-w-[160px] sm:max-w-[220px]">
                  {publicKeyJwk?.x ? `P256-X:${publicKeyJwk.x.substring(0, 10)}...` : "Active"}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                Client-Side Only
              </span>
            </div>

            {!imageBlob || !previewUrl || !latestRecord ? (
              /* Phase 1: Capture Source (Camera / Upload / Synthetic) */
              <div className="w-full flex flex-col items-center gap-4">
                <div className="text-center max-w-md">
                  <h2 className="text-xl font-bold text-white">Capture & Authenticate</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Select a capture source below. The image is instantly digested (SHA-256) and signed with ECDSA P-256 at the moment of capture.
                  </p>
                </div>

                <CaptureView
                  onCaptureComplete={handleCaptureComplete}
                  isProcessing={isProcessing}
                />
              </div>
            ) : (
              /* Phase 2: Active Image with Edit & Hash-Chain Panel */
              <div className="w-full flex flex-col items-center gap-8">
                {/* Hash Chain Progress Indicator */}
                <div className="w-full max-w-2xl bg-gray-900/60 p-4 rounded-2xl border border-gray-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Cryptographic Chain of Custody ({manifest.chain.length} Block
                      {manifest.chain.length > 1 ? "s" : ""})
                    </span>
                    <button
                      onClick={handleResetCapture}
                      className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> New Capture
                    </button>
                  </div>

                  {/* Chain Links Horizontal Visualizer */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {manifest.chain.map((rec, idx) => (
                      <React.Fragment key={rec.recordId}>
                        <div className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-lg bg-gray-950 border border-emerald-500/30 text-xs font-mono">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="uppercase text-gray-200 font-semibold">{rec.action}</span>
                          <span className="text-gray-500 text-[10px]">
                            {rec.contentHash.substring(0, 6)}...
                          </span>
                        </div>
                        {idx < manifest.chain.length - 1 && (
                          <ArrowRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Edit & Chaining Controls */}
                <EditPanel
                  currentImageBlob={imageBlob}
                  currentPreviewUrl={previewUrl}
                  latestRecord={latestRecord}
                  onApplyEdit={handleApplyEdit}
                  isProcessing={isProcessing}
                />

                {/* Export / Hand-off Actions */}
                <div className="w-full max-w-xl flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                    <button
                      onClick={handleExportAll}
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-gray-800 to-gray-800/90 hover:from-gray-700 hover:to-gray-700/90 text-white font-medium border border-gray-700 text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
                      title="Download both image and manifest"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Download Bundle (Both Files)</span>
                    </button>

                    <button
                      onClick={handleSendToVerifier}
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Send to Verifier</span>
                    </button>
                  </div>

                  {/* Individual Quick Download Buttons */}
                  <div className="flex items-center gap-2 w-full justify-end text-xs">
                    <span className="text-gray-500 text-[11px] font-mono mr-auto">Download separately:</span>
                    <button
                      onClick={handleExportImage}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Download image file only"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Image (.
                        {imageBlob.type
                          ? MIME_TO_EXT[imageBlob.type.split(";")[0].trim().toLowerCase()] || "png"
                          : "png"}
                        )
                      </span>
                    </button>

                    <button
                      onClick={handleExportManifest}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Download manifest JSON only"
                    >
                      <FileJson className="w-3.5 h-3.5 text-emerald-400" />
                      <span>manifest.json</span>
                    </button>

                    <button
                      onClick={handleCopyManifest}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Copy manifest JSON to clipboard"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: AUDIT & VERIFIER */
          <div className="w-full flex flex-col items-center gap-8">
            <div className="text-center max-w-md">
              <h2 className="text-xl font-bold text-white">Cryptographic Verifier</h2>
              <p className="text-xs text-gray-400 mt-1">
                Drag and drop any exported image alongside its <code className="text-emerald-400">manifest.json</code>.
                The engine independently recalculates SHA-256 hashes and validates every ECDSA P-256 signature in the chain.
              </p>
            </div>

            {verificationReport ? (
              <VerificationReport
                report={verificationReport}
                imageFileName={targetImageName}
                onReset={() => setVerificationReport(null)}
              />
            ) : (
              <VerifierDropzone
                onVerify={handleVerifyDrop}
                onSimulateTamperDemo={handleSimulateTamper}
                isVerifying={isVerifying}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/80 py-4 text-center text-[11px] text-gray-500 font-mono">
        TrueCapture PoC • 100% Client-Side Web Crypto (ECDSA P-256 & SHA-256) • Zero Data Leaves Browser
      </footer>
    </div>
  );
};
export default App;
