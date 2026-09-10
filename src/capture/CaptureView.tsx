import React, { useState } from "react";
import { Camera, Upload, Sparkles, SlidersHorizontal, Info } from "lucide-react";
import type { CaptureMode } from "./captureSource";
import { DEFAULT_CAPTURE_MODE } from "./captureSource";
import { CameraCapture } from "./CameraCapture";
import { UploadCapture } from "./UploadCapture";
import { SyntheticCapture } from "./SyntheticCapture";

interface CaptureViewProps {
  onCaptureComplete: (blob: Blob, previewUrl: string) => void;
  isProcessing?: boolean;
}

export const CaptureView: React.FC<CaptureViewProps> = ({
  onCaptureComplete,
  isProcessing,
}) => {
  const [activeMode, setActiveMode] = useState<CaptureMode>(DEFAULT_CAPTURE_MODE);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  const handleFallback = (reason: string) => {
    setFallbackMessage(reason);
    setActiveMode("upload");
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Capture Mode Selector Toolbar */}
      <div className="w-full max-w-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-900/70 p-2.5 rounded-2xl border border-gray-800 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-mono text-gray-400 px-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
          <span>CAPTURE SOURCE:</span>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto bg-gray-950 p-1 rounded-xl border border-gray-800/80">
          <button
            type="button"
            onClick={() => {
              setFallbackMessage(null);
              setActiveMode("camera");
            }}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === "camera"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("upload")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === "upload"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("synthetic")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === "synthetic"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Synthetic</span>
          </button>
        </div>
      </div>

      {fallbackMessage && (
        <div className="w-full max-w-xl mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{fallbackMessage}</span>
        </div>
      )}

      {/* Active Mode Render */}
      <div className="w-full">
        {activeMode === "camera" && (
          <CameraCapture
            onImageCaptured={onCaptureComplete}
            onFallbackToUpload={handleFallback}
            disabled={isProcessing}
          />
        )}
        {activeMode === "upload" && (
          <UploadCapture
            onImageCaptured={onCaptureComplete}
            disabled={isProcessing}
          />
        )}
        {activeMode === "synthetic" && (
          <SyntheticCapture
            onImageCaptured={onCaptureComplete}
            disabled={isProcessing}
          />
        )}
      </div>
    </div>
  );
};
