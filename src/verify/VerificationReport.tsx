import React, { useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertOctagon,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Clock,
  Key,
  Hash,
  Link as LinkIcon,
  Layers,
} from "lucide-react";
import type { VerificationReportData } from "../types/manifest";

interface VerificationReportProps {
  report: VerificationReportData;
  imageFileName?: string;
  onReset?: () => void;
}

export const VerificationReport: React.FC<VerificationReportProps> = ({
  report,
  imageFileName,
  onReset,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 animate-fade-in">
      {/* Overall Verdict Banner */}
      <div
        className={`w-full p-6 rounded-2xl border backdrop-blur-xl transition-all ${
          report.overallValid
            ? "glass-panel-glow border-emerald-500/50 bg-emerald-950/20"
            : "glass-panel-danger border-rose-500/50 bg-rose-950/20"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                report.overallValid
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}
            >
              {report.overallValid ? (
                <ShieldCheck className="w-8 h-8" />
              ) : (
                <ShieldAlert className="w-8 h-8" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {report.overallValid ? "Chain Intact ✅" : "Tampered ❌"}
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                    report.overallValid
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {report.overallValid ? "CRYPTOGRAPHICALLY AUTHENTIC" : "INTEGRITY BREACH"}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1 font-mono">
                {report.summary}
              </p>
            </div>
          </div>

          {onReset && (
            <button
              onClick={onReset}
              className="px-4 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium border border-gray-700 transition-colors cursor-pointer shrink-0"
            >
              Verify Another
            </button>
          )}
        </div>

        {/* Content Hash Comparison Details */}
        <div className="mt-5 pt-4 border-t border-gray-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-gray-950/60 border border-gray-800/80 flex flex-col gap-1">
            <span className="text-gray-500">Image File Hash (SHA-256):</span>
            <span
              className={`truncate font-semibold ${
                report.finalImageHash === report.manifestFinalHash
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
              title={report.finalImageHash}
            >
              {report.finalImageHash || "N/A (no image loaded)"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-gray-950/60 border border-gray-800/80 flex flex-col gap-1">
            <span className="text-gray-500">Manifest Leaf Hash (Signed):</span>
            <span className="text-emerald-400 font-semibold truncate" title={report.manifestFinalHash}>
              {report.manifestFinalHash || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Step-by-Step Chain of Custody Audit */}
      <div className="bg-gray-900/60 rounded-2xl border border-gray-800 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-gray-200">
              Chain-of-Custody Timeline ({report.steps.length} Steps)
            </h3>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {imageFileName ? `Target: ${imageFileName}` : "Audit Trail"}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {report.steps.map((step, idx) => {
            const isLeaf = idx === report.steps.length - 1;
            const isGenesis = idx === 0;
            const isExpanded = expandedIndex === idx;

            return (
              <div
                key={step.recordId}
                className={`rounded-xl border transition-all overflow-hidden ${
                  step.status === "valid"
                    ? "bg-gray-950/80 border-gray-800 hover:border-gray-700"
                    : "bg-rose-950/30 border-rose-500/50 shadow-sm shadow-rose-500/10"
                }`}
              >
                {/* Step Header Row */}
                <div
                  onClick={() => toggleExpand(idx)}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${
                        step.status === "valid"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                      }`}
                    >
                      {step.stepIndex}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                          {step.action}
                        </span>
                        {isGenesis && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono">
                            GENESIS
                          </span>
                        )}
                        {isLeaf && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                            LEAF
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {new Date(step.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {step.status === "valid" ? (
                        <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-rose-400 flex items-center gap-1 font-semibold">
                          <XCircle className="w-3.5 h-3.5" /> {step.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>

                {/* Failure explanation box if this step failed */}
                {step.failureReason && (
                  <div className="px-4 py-2.5 bg-rose-950/60 border-t border-b border-rose-500/30 text-rose-200 text-xs font-mono flex items-start gap-2">
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-rose-300">Failure Diagnostic: </strong>
                      <span>{step.failureReason}</span>
                    </div>
                  </div>
                )}

                {/* Expanded Technical Inspection */}
                {isExpanded && (
                  <div className="p-4 bg-gray-900/40 border-t border-gray-800/80 flex flex-col gap-2.5 text-xs font-mono">
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-emerald-400" /> Content Hash:
                      </span>
                      <span className="text-gray-300 bg-gray-950 p-1.5 rounded-lg border border-gray-800 break-all select-all">
                        {step.contentHash}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-teal-400" /> Previous Record Link:
                      </span>
                      <span className="text-gray-300 bg-gray-950 p-1.5 rounded-lg border border-gray-800 break-all select-all">
                        {step.previousRecordHash ?? "null (Genesis Root)"}
                      </span>
                      {step.expectedPreviousRecordHash && (
                        <span className="text-[11px] text-gray-500">
                          Expected: {step.expectedPreviousRecordHash} (
                          {step.isChainLinkValid ? "Link verified" : "Link mismatch"})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-400" /> Signature Status:
                      </span>
                      <span
                        className={`p-1.5 rounded-lg border flex items-center gap-2 ${
                          step.isSignatureValid
                            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                            : "bg-rose-950/20 border-rose-500/30 text-rose-300"
                        }`}
                      >
                        {step.isSignatureValid ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            ECDSA P-256 signature verified against public key
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Signature verification failed
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-400" /> Timestamp (Unix ms):
                      </span>
                      <span className="text-gray-300 bg-gray-950 p-1.5 rounded-lg border border-gray-800">
                        {step.timestamp} ({new Date(step.timestamp).toISOString()})
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-gray-500">Record ID:</span>
                      <span className="text-gray-400 bg-gray-950 p-1.5 rounded-lg border border-gray-800">
                        {step.recordId}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
