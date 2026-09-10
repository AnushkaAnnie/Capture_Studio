import React, { useState, useRef } from "react";
import { Upload, FileText, Image as ImageIcon, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import type { Manifest } from "../types/manifest";

interface VerifierDropzoneProps {
  onVerify: (imageBlob: Blob, manifest: Manifest, imageFileName?: string) => void;
  onSimulateTamperDemo?: (mode: "image_byte" | "manifest_data") => void;
  isVerifying?: boolean;
}

export const VerifierDropzone: React.FC<VerifierDropzoneProps> = ({
  onVerify,
  onSimulateTamperDemo,
  isVerifying,
}) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [parsedManifest, setParsedManifest] = useState<Manifest | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const manifestInputRef = useRef<HTMLInputElement>(null);

  const handleProcessImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Selected file for image is not a valid image format.");
      return;
    }
    setErrorMsg(null);
    setImageFile(file);
    if (parsedManifest) {
      onVerify(file, parsedManifest, file.name);
    }
  };

  const handleProcessManifest = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.chain || !Array.isArray(json.chain)) {
        throw new Error("Invalid manifest structure: missing 'chain' array.");
      }
      setErrorMsg(null);
      setManifestFile(file);
      setParsedManifest(json as Manifest);
      if (imageFile) {
        onVerify(imageFile, json as Manifest, imageFile.name);
      }
    } catch (err: unknown) {
      setErrorMsg(`Failed to parse manifest JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCombinedDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    let img: File | null = imageFile;
    let man: Manifest | null = parsedManifest;
    let manFile: File | null = manifestFile;

    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      if (file.name.endsWith(".json") || file.type === "application/json") {
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          if (json.chain && Array.isArray(json.chain)) {
            man = json as Manifest;
            manFile = file;
          }
        } catch {
          // ignore
        }
      } else if (file.type.startsWith("image/")) {
        img = file;
      }
    }

    if (img) setImageFile(img);
    if (manFile) setManifestFile(manFile);
    if (man) setParsedManifest(man);

    if (img && man) {
      setErrorMsg(null);
      onVerify(img, man, img.name);
    }
  };

  const handleManualTriggerVerify = () => {
    if (imageFile && parsedManifest) {
      onVerify(imageFile, parsedManifest, imageFile.name);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* Combined Drag and Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={handleCombinedDrop}
        className="w-full border-2 border-dashed border-gray-700 hover:border-emerald-500/60 bg-gray-900/60 rounded-2xl p-6 transition-all flex flex-col items-center justify-center text-center gap-4 cursor-pointer"
      >
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Upload className="w-6 h-6" />
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-200">
            Drag & Drop Image + Manifest JSON Together
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Drop both files at once or select them individually below to verify cryptographic custody
          </p>
        </div>

        {/* Individual File Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-2">
          {/* Image Input */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              imageInputRef.current?.click();
            }}
            className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer ${
              imageFile
                ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-300"
                : "border-gray-800 bg-gray-950/80 hover:border-gray-700 text-gray-400"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <ImageIcon className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="truncate">
                <p className="text-xs font-semibold text-gray-200 truncate">
                  {imageFile ? imageFile.name : "1. Select Image"}
                </p>
                <p className="text-[10px] text-gray-500">
                  {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : "PNG / JPEG / WebP"}
                </p>
              </div>
            </div>
            {imageFile && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessImage(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Manifest Input */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              manifestInputRef.current?.click();
            }}
            className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer ${
              manifestFile
                ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-300"
                : "border-gray-800 bg-gray-950/80 hover:border-gray-700 text-gray-400"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <FileText className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="truncate">
                <p className="text-xs font-semibold text-gray-200 truncate">
                  {manifestFile ? manifestFile.name : "2. Select Manifest"}
                </p>
                <p className="text-[10px] text-gray-500">
                  {parsedManifest
                    ? `${parsedManifest.chain.length} signed records`
                    : "manifest.json file"}
                </p>
              </div>
            </div>
            {manifestFile && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            <input
              ref={manifestInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessManifest(e.target.files[0]);
                }
              }}
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Buttons: Verify & Tamper Demos */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-900/40 p-3 rounded-xl border border-gray-800">
        <button
          onClick={handleManualTriggerVerify}
          disabled={!imageFile || !parsedManifest || isVerifying}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          {isVerifying ? "Verifying Cryptographic Proofs..." : "Re-Verify Chain Now"}
        </button>

        {onSimulateTamperDemo && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-mono text-gray-400">Simulate:</span>
            <button
              onClick={() => onSimulateTamperDemo("image_byte")}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono transition-colors cursor-pointer"
              title="Alters 1 byte of the image to trigger hash mismatch"
            >
              Tamper Image Byte
            </button>
            <button
              onClick={() => onSimulateTamperDemo("manifest_data")}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono transition-colors cursor-pointer"
              title="Alters manifest signature or timestamp"
            >
              Tamper Manifest
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
