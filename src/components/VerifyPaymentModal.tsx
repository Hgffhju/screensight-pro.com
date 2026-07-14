import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Lock, Unlock, CheckCircle, AlertTriangle, Coins, Smartphone, Key, Loader2 } from "lucide-react";

interface VerifyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onPurchaseSuccess: () => void;
  setActivePaymentCode: (code: string) => void;
  onAddLog: (msg: string, type: "success" | "error" | "info" | "high" | "trading") => void;
}

export const VerifyPaymentModal: React.FC<VerifyPaymentModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPurchaseSuccess,
  setActivePaymentCode,
  onAddLog,
}) => {
  const [payerPhone, setPayerPhone] = useState<string>("");
  const [transactionCode, setTransactionCode] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError("Authentication required: Please sign in or register to complete activation.");
      return;
    }
    if (!payerPhone || !payerPhone.trim()) {
      setError("Phone number is required for transaction auditing.");
      return;
    }
    if (!transactionCode || transactionCode.trim().length !== 10) {
      setError("Invalid code: M-Pesa transaction codes must be exactly 10 alphanumeric characters (e.g. SDR2A349DF).");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const token = await currentUser.getIdToken();
      
      const payload = {
        strategyId: "strat_analysis_pass", // AI Scanner & Confluence Activation Pass
        phoneNumber: payerPhone.trim(),
        transactionCode: transactionCode.toUpperCase().trim(),
        amountPaid: 300, // KES 300
        recipientPhone: "0794300156"
      };

      const res = await fetch("/api/premium/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "M-Pesa payment validation failed.");
      }

      setSuccess(true);
      setActivePaymentCode(transactionCode.toUpperCase().trim());
      onAddLog(`Payment Activated: Successfully verified transaction ${transactionCode.toUpperCase()}! AI Scanning & Confluence features unlocked.`, "success");
      
      // Update local and global lists
      setTimeout(() => {
        onPurchaseSuccess();
        onClose();
        // Reset states
        setPayerPhone("");
        setTransactionCode("");
        setSuccess(false);
      }, 1800);

    } catch (err: any) {
      setError(err.message || "An error occurred during verification.");
      onAddLog(`Activation Failure: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative bg-[#090f1e] border border-[#00c8f0]/40 rounded-lg max-w-md w-full shadow-2xl p-6 flex flex-col gap-4 overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-[#00c8f0] to-transparent shadow-[0_0_20px_2px_#00c8f0]" />

            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#00c8f0]/10 border border-[#00c8f0]/30 rounded text-[#00c8f0]">
                  <Coins className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-white text-sm tracking-wide uppercase">AI Engine Activation</h3>
                  <p className="text-[10px] text-[#4a6580]">Instant verification with PoChi la Biashara</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/5 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instruction block */}
            <div className="p-3 bg-black/40 border border-[#152236] rounded text-[10.5px] text-[#b8d0e8] leading-relaxed flex flex-col gap-2">
              <span className="font-semibold text-[#00c8f0] uppercase tracking-wider text-[9.5px]">How to Activate:</span>
              <ol className="list-decimal list-inside flex flex-col gap-1.5 text-gray-300">
                <li>Go to <strong className="text-white">M-PESA</strong> on your phone</li>
                <li>Select <strong className="text-white">Lipa na M-PESA</strong> &gt; <strong className="text-white">Pochi la Biashara</strong></li>
                <li>Enter phone number: <strong className="text-[#00df6e] font-mono">0794300156</strong> (Verified)</li>
                <li>Pay <strong className="text-[#00df6e]">KES 300</strong> for the AI Analysis Pass</li>
                <li>Paste the 10-character transaction receipt code below</li>
              </ol>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9.5px] font-mono text-[#7a98b4] uppercase tracking-wider flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-[#00c8f0]/70" />
                  Payer Phone Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0712345678"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  disabled={submitting || success}
                  className="bg-black border border-[#152236] focus:border-[#00c8f0]/60 text-white rounded px-3 py-2 text-xs focus:outline-none placeholder-gray-600 transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9.5px] font-mono text-[#7a98b4] uppercase tracking-wider flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-[#00c8f0]/70" />
                  M-Pesa Transaction Code (10 Chars)
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="e.g. SDR2A349DF"
                  value={transactionCode}
                  onChange={(e) => setTransactionCode(e.target.value.toUpperCase().trim())}
                  disabled={submitting || success}
                  className="bg-black border border-[#152236] focus:border-[#00c8f0]/60 text-white rounded px-3 py-2 text-xs font-mono focus:outline-none placeholder-gray-600 tracking-widest uppercase transition"
                />
              </div>

              {/* Status Display */}
              {error && (
                <div className="p-2.5 bg-[#f03060]/10 border border-[#f03060]/30 text-[#f03060] rounded text-[10.5px] flex items-start gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-2.5 bg-[#00df6e]/10 border border-[#00df6e]/30 text-[#00df6e] rounded text-[10.5px] flex items-center gap-2 animate-pulse">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="font-bold">Verification Success! Activating core system...</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="w-1/3 py-2 bg-[#152236]/30 hover:bg-[#152236]/60 border border-[#152236] text-gray-300 hover:text-white rounded text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || success}
                  className="flex-grow py-2 bg-[#00c8f0] hover:bg-[#00c8f0]/90 text-black font-bold text-xs uppercase rounded flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(0,200,240,0.2)]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Verifying Code...
                    </>
                  ) : success ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Unlocked!
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Verify & Activate
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
