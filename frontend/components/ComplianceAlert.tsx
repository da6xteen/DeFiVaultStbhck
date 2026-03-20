"use client";

import { AlertTriangle } from "lucide-react";

interface ComplianceAlertProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  travelRuleData: {
    originatorName: string;
    beneficiaryName: string;
    thresholdUsdc: number;
    transactionAmountUsdc: number;
  };
}

export default function ComplianceAlert({
  isOpen,
  onConfirm,
  onCancel,
  travelRuleData,
}: ComplianceAlertProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0f1420] border border-border rounded-lg shadow-2xl overflow-hidden">
        <div className="bg-warning/10 p-4 border-b border-border flex items-center gap-3">
          <AlertTriangle className="text-warning w-6 h-6" />
          <h2 className="text-lg font-bold text-white">Travel Rule Required</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-400">
            This transaction exceeds <span className="text-white font-mono">${travelRuleData.thresholdUsdc.toLocaleString()} USDC</span>.
            Under FATF Travel Rule requirements, counterparty information must be recorded for institutional compliance.
          </p>

          <div className="bg-[#080c14] rounded p-4 border border-border space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Originator</span>
              <span className="text-white font-mono">{travelRuleData.originatorName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Beneficiary</span>
              <span className="text-white font-mono">{travelRuleData.beneficiaryName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Amount</span>
              <span className="text-success font-mono">{travelRuleData.transactionAmountUsdc.toFixed(2)} USDC</span>
            </div>
          </div>

          <p className="text-[10px] text-gray-500 uppercase tracking-wider">
            By proceeding, you acknowledge that this data will be stored securely for regulatory auditing purposes.
          </p>
        </div>

        <div className="flex border-t border-border">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-400 hover:bg-white/5 transition-colors border-r border-border"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
          >
            Confirm & Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
