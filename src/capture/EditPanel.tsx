import React, { useState } from "react";
import { Sparkles, Crop, Palette, ArrowRight, ShieldCheck, Check } from "lucide-react";
import type { CaptureRecord } from "../types/manifest";

interface EditPanelProps {
  currentImageBlob?: Blob;
  currentPreviewUrl: string;
  latestRecord: CaptureRecord;
  onApplyEdit: (newBlob: Blob, newPreviewUrl: string, action: "grayscale" | "crop") => Promise<void>;
  isProcessing?: boolean;
}

export const EditPanel: React.FC<EditPanelProps> = ({
  currentPreviewUrl,
  latestRecord,
  onApplyEdit,
  isProcessing,
}) => {
  const [selectedAction, setSelectedAction] = useState<"grayscale" | "crop">("grayscale");
  const [justApplied, setJustApplied] = useState(false);

  const applyGrayscaleTransformation = (img: HTMLImageElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D context unavailable"));

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Grayscale conversion using Rec. 601 luma coefficients
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imgData, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export grayscale canvas blob"));
      }, "image/png");
    });
  };

  const applyCropTransformation = (img: HTMLImageElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      // Crop 10% from each side (80% central crop)
      const cropX = Math.round(origW * 0.1);
      const cropY = Math.round(origH * 0.1);
      const cropW = Math.round(origW * 0.8);
      const cropH = Math.round(origH * 0.8);

      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D context unavailable"));

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export crop canvas blob"));
      }, "image/png");
    });
  };

  const handleExecuteEdit = async () => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = currentPreviewUrl;
      await new Promise((res, rej) => {
        img.onload = () => res(true);
        img.onerror = rej;
      });

      let newBlob: Blob;
      if (selectedAction === "grayscale") {
        newBlob = await applyGrayscaleTransformation(img);
      } else {
        newBlob = await applyCropTransformation(img);
      }

      const newPreviewUrl = URL.createObjectURL(newBlob);
      await onApplyEdit(newBlob, newPreviewUrl, selectedAction);

      setJustApplied(true);
      setTimeout(() => setJustApplied(false), 2500);
    } catch (err) {
      console.error("Error applying edit transformation:", err);
      alert("Failed to apply transformation to image.");
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-5">
      {/* Current Image Preview & Telemetry */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-gray-950 p-2 shadow-2xl flex flex-col items-center">
        <div className="relative w-full max-h-[360px] rounded-xl overflow-hidden bg-black/60 flex items-center justify-center">
          <img
            src={currentPreviewUrl}
            alt="Current chain leaf"
            className="max-h-[360px] w-auto object-contain"
          />
          <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-gray-700/80 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Latest: {latestRecord.action.toUpperCase()}</span>
          </div>
        </div>

        {/* Cryptographic metadata snippet */}
        <div className="w-full mt-3 px-3 py-2 bg-gray-900/60 rounded-xl border border-gray-800/80 flex flex-col gap-1 text-[11px] font-mono text-gray-400">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Record ID:</span>
            <span className="text-gray-300 truncate max-w-[240px]">{latestRecord.recordId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">SHA-256 Hash:</span>
            <span className="text-emerald-400 font-semibold truncate max-w-[240px]">
              {latestRecord.contentHash.substring(0, 16)}...
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Chain Link:</span>
            <span className="text-teal-400 truncate max-w-[240px]">
              {latestRecord.previousRecordHash
                ? `${latestRecord.previousRecordHash.substring(0, 16)}...`
                : "GENESIS (Root)"}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Options Selection */}
      <div className="bg-gray-900/70 p-4 rounded-2xl border border-gray-800 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Apply Tamper-Evident Edit
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Applying an edit generates a new image state and cryptographically appends an immutable block to the chain.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedAction("grayscale")}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
              selectedAction === "grayscale"
                ? "border-emerald-500 bg-emerald-950/20 text-emerald-300"
                : "border-gray-800 bg-gray-950 hover:border-gray-700 text-gray-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <Palette className="w-4 h-4 text-emerald-400" />
              {selectedAction === "grayscale" && (
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>
            <span className="text-xs font-semibold mt-1">Grayscale Filter</span>
            <span className="text-[10px] text-gray-500">Rec. 601 Luma matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAction("crop")}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
              selectedAction === "crop"
                ? "border-emerald-500 bg-emerald-950/20 text-emerald-300"
                : "border-gray-800 bg-gray-950 hover:border-gray-700 text-gray-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <Crop className="w-4 h-4 text-emerald-400" />
              {selectedAction === "crop" && (
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>
            <span className="text-xs font-semibold mt-1">Central Crop</span>
            <span className="text-[10px] text-gray-500">80% focal crop</span>
          </button>
        </div>

        <button
          onClick={handleExecuteEdit}
          disabled={isProcessing}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
        >
          {justApplied ? (
            <>
              <Check className="w-4 h-4 text-black" />
              <span>Chained & Signed Successfully!</span>
            </>
          ) : (
            <>
              <span>Apply {selectedAction.toUpperCase()} & Append to Chain</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
