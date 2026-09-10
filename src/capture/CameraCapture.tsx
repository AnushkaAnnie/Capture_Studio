import React, { useRef, useEffect, useState } from "react";
import { Camera, AlertCircle, RefreshCw, FlipHorizontal } from "lucide-react";

interface CameraCaptureProps {
  onImageCaptured: (blob: Blob, previewUrl: string) => void;
  onFallbackToUpload: (reason: string) => void;
  disabled?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onImageCaptured,
  onFallbackToUpload,
  disabled,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(true);

  const isMountedRef = useRef(true);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (isMountedRef.current) {
      setCameraActive(false);
    }
  };

  const startCamera = async () => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    setErrorNotice(null);
    setCameraActive(false);

    // Stop any previous stream before requesting a new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API (getUserMedia) is not supported in this browser environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });

      // If unmounted or cancelled while permission was requested, clean up immediately
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;

        const playVideo = () => {
          if (!isMountedRef.current) return;
          video.play().catch((playErr) => {
            // AbortError is normal when play() is interrupted by remount or load; ignore safely
            if (playErr instanceof DOMException && playErr.name === "AbortError") {
              return;
            }
            console.warn("Video play() interrupted or failed:", playErr);
          });
        };

        if (video.readyState >= 1) {
          playVideo();
        } else {
          video.onloadedmetadata = () => {
            playVideo();
          };
        }
      }

      if (isMountedRef.current) {
        setCameraActive(true);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      // Ignore AbortError caused by rapid mount/unmount in StrictMode
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      console.warn("Camera access failed or denied:", err);
      const isDenied = err instanceof DOMException && err.name === "NotAllowedError";
      const isNotFound = err instanceof DOMException && err.name === "NotFoundError";
      const reason = isDenied
        ? "Camera permission was denied. Please allow camera access or use File Upload mode."
        : isNotFound
        ? "No camera device detected on this system. Falling back to File Upload mode."
        : `Camera error (${err instanceof Error ? err.message : "unavailable"}). Falling back to File Upload mode.`;

      setErrorNotice(reason);

      if (isDenied || isNotFound) {
        fallbackTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            onFallbackToUpload(reason);
          }
        }, 2500);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    startCamera();
    return () => {
      isMountedRef.current = false;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
      stopCamera();
    };
  }, []);

  const handleCaptureSnapshot = () => {
    const video = videoRef.current;
    if (!video || !cameraActive) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const previewUrl = URL.createObjectURL(blob);
      stopCamera();
      onImageCaptured(blob, previewUrl);
    }, "image/png");
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-xl mx-auto">
      {errorNotice && (
        <div className="w-full p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 flex items-start gap-3 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-300">Camera Notice</p>
            <p className="text-xs text-amber-300/80 mt-0.5">{errorNotice}</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry Camera
              </button>
              <button
                type="button"
                onClick={() => onFallbackToUpload(errorNotice)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs font-medium transition-colors cursor-pointer"
              >
                Switch to File Upload
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-black aspect-video w-full max-w-[540px] flex items-center justify-center shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transition-transform duration-300 ${
            isMirrored ? "scale-x-[-1]" : ""
          }`}
        />

        {!cameraActive && !errorNotice && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-2 bg-gray-950">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
            <span className="text-xs font-mono">Initializing camera feed...</span>
          </div>
        )}

        {cameraActive && (
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white border border-gray-700/80 transition-colors backdrop-blur-md cursor-pointer"
              title="Mirror preview"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleCaptureSnapshot}
        disabled={!cameraActive || disabled}
        className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
      >
        <Camera className="w-4 h-4" />
        Take Snapshot & Cryptographically Sign
      </button>
    </div>
  );
};
