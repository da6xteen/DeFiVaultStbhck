"use client";

import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

interface TransactionModalProps {
  isOpen: boolean;
  status: 'confirming' | 'signing' | 'processing' | 'success' | 'error';
  message: string;
  txSignature?: string;
  error?: string;
  onClose: () => void;
}

export default function TransactionModal({
  isOpen,
  status,
  message,
  txSignature,
  error,
  onClose,
}: TransactionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#0f1420] border border-border rounded-lg shadow-2xl p-6 text-center">
        <div className="flex justify-center mb-4">
          {status === 'processing' || status === 'signing' || status === 'confirming' ? (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle2 className="w-12 h-12 text-success" />
          ) : (
            <XCircle className="w-12 h-12 text-danger" />
          )}
        </div>

        <h3 className="text-xl font-bold mb-2">
          {status === 'signing' ? 'Sign Transaction' :
           status === 'processing' ? 'Processing' :
           status === 'confirming' ? 'Confirming' :
           status === 'success' ? 'Transaction Success' : 'Transaction Failed'}
        </h3>

        <p className="text-gray-400 text-sm mb-6">
          {message}
        </p>

        {txSignature && (
          <div className="mb-6">
            <a
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-primary hover:underline font-mono"
            >
              View on Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded p-3 mb-6 text-xs text-danger text-left font-mono overflow-auto max-h-24">
            {error}
          </div>
        )}

        {(status === 'success' || status === 'error') && (
          <button
            onClick={onClose}
            className="w-full bg-card hover:bg-white/5 border border-border py-2 rounded font-medium transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
