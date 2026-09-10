import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, CheckCircle2 } from "lucide-react";

interface UploadCaptureProps {
  onImageCaptured: (blob: Blob, previewUrl: string) => void;
  disabled?: boolean;
}

export const UploadCapture: React.FC<UploadCaptureProps> = ({
  onImageCaptured,
  disabled,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPEG, WebP, etc.)");
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleCommitCapture = () => {
    if (!selectedFile || !preview) return;
    onImageCaptured(selectedFile, preview);
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-xl mx-auto">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 min-h-[260px] ${
          dragActive
            ? "border-emerald-500 bg-emerald-950/20"
            : "border-gray-700 hover:border-gray-500 bg-gray-900/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
          disabled={disabled}
        />

        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-64 h-48 rounded-lg overflow-hidden border border-gray-700 shadow-md">
              <img
                src={preview}
                alt="Selected preview"
                className="w-full h-full object-contain bg-black/40"
              />
            </div>
            <p className="text-xs text-gray-400 font-mono">
              {selectedFile?.name} ({(selectedFile?.size ? selectedFile.size / 1024 : 0).toFixed(1)} KB)
            </p>
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Click or drop new image to change
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center text-emerald-400 border border-gray-700">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">
                Choose an image or drag & drop here
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPEG, WebP, SVG • Up to 25MB
              </p>
            </div>
            <span className="text-xs px-3 py-1 bg-gray-800/80 text-gray-400 rounded-full border border-gray-700">
              Zero external permissions required
            </span>
          </div>
        )}
      </div>

      <button
        onClick={handleCommitCapture}
        disabled={!selectedFile || disabled}
        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <ImageIcon className="w-5 h-5" />
        Capture & Cryptographically Sign Image
      </button>
    </div>
  );
};
