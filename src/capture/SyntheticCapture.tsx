import React, { useRef, useEffect, useState, useCallback } from "react";
import { Sparkles, RefreshCw, KeyRound } from "lucide-react";

interface SyntheticCaptureProps {
  onImageCaptured: (blob: Blob, previewUrl: string) => void;
  disabled?: boolean;
}

export const SyntheticCapture: React.FC<SyntheticCaptureProps> = ({
  onImageCaptured,
  disabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(() => Date.now());
  const [timestampStr, setTimestampStr] = useState(() => new Date().toISOString());

  const drawSyntheticImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 640;
    const height = 480;
    canvas.width = width;
    canvas.height = height;

    // Pseudo-random deterministic generator from seed
    let s = seed;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    // 1. Dynamic Mesh/Linear Gradient Background
    const grad = ctx.createLinearGradient(0, 0, width, height);
    const hues = [
      Math.floor(rand() * 360),
      Math.floor(rand() * 360),
      Math.floor(rand() * 360),
    ];
    grad.addColorStop(0, `hsl(${hues[0]}, 80%, 15%)`);
    grad.addColorStop(0.5, `hsl(${hues[1]}, 75%, 25%)`);
    grad.addColorStop(1, `hsl(${hues[2]}, 90%, 10%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle cryptographic grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Random Geometric Shapes (Circles, Rings, Polygons)
    const shapeCount = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < shapeCount; i++) {
      const cx = 80 + rand() * (width - 160);
      const cy = 80 + rand() * (height - 160);
      const radius = 25 + rand() * 65;
      const shapeHue = (hues[0] + i * 50) % 360;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${shapeHue}, 85%, 60%, ${0.15 + rand() * 0.25})`;
      ctx.fill();

      ctx.lineWidth = 2 + rand() * 3;
      ctx.strokeStyle = `hsla(${shapeHue}, 90%, 75%, ${0.4 + rand() * 0.4})`;
      ctx.stroke();

      // Inner polygon accent
      ctx.beginPath();
      const sides = 3 + Math.floor(rand() * 4);
      for (let j = 0; j < sides; j++) {
        const angle = (j / sides) * Math.PI * 2 + rand();
        const px = cx + Math.cos(angle) * (radius * 0.6);
        const py = cy + Math.sin(angle) * (radius * 0.6);
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `hsla(${(shapeHue + 120) % 360}, 90%, 70%, 0.3)`;
      ctx.fill();
    }

    // 4. Cryptographic Proof Banner & Watermark
    ctx.fillStyle = "rgba(10, 15, 30, 0.75)";
    ctx.fillRect(20, height - 110, width - 40, 90);
    ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(20, height - 110, width - 40, 90);

    // Header text
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#34d399";
    ctx.fillText("✦ TRUECAPTURE PROOF-OF-FRESHNESS SYNTHETIC VECTOR", 36, height - 82);

    // Timestamp & Seed metadata text
    ctx.font = "13px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`TIMESTAMP: ${timestampStr}`, 36, height - 58);
    ctx.fillText(`ENTROPY SEED: 0x${seed.toString(16).toUpperCase()}`, 36, height - 36);

    // Glowing badge icon placeholder
    ctx.beginPath();
    ctx.arc(width - 55, height - 65, 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
    ctx.fill();
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [seed, timestampStr]);

  useEffect(() => {
    drawSyntheticImage();
  }, [drawSyntheticImage]);

  const handleRegenerate = () => {
    const now = Date.now();
    setSeed(now);
    setTimestampStr(new Date(now).toISOString());
  };

  const handleCommitCapture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const previewUrl = URL.createObjectURL(blob);
      onImageCaptured(blob, previewUrl);
    }, "image/png");
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-xl mx-auto">
      <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-gray-950/80 shadow-2xl p-2 w-full flex justify-center">
        <canvas
          ref={canvasRef}
          className="w-full max-w-[540px] h-auto rounded-xl aspect-[4/3] bg-black shadow-inner"
        />
        <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-700/80 flex items-center gap-2 text-xs font-mono text-emerald-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Synthetic Canvas Mode</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        <button
          onClick={handleRegenerate}
          disabled={disabled}
          className="px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium transition-colors flex items-center gap-2 cursor-pointer text-sm"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
          Regenerate Pattern
        </button>

        <button
          onClick={handleCommitCapture}
          disabled={disabled}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
        >
          <KeyRound className="w-4 h-4" />
          Capture & Sign Synthetic Image
        </button>
      </div>
    </div>
  );
};
