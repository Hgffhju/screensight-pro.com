import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Cloud, 
  Trash2, 
  ExternalLink, 
  Calendar, 
  ShieldAlert, 
  Database,
  Layers
} from "lucide-react";

interface CloudHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cloudConfluences: any[];
  onLoadConfluence: (item: any) => void;
  onDeleteConfluence: (id: string) => void;
}

export const CloudHistoryDrawer: React.FC<CloudHistoryDrawerProps> = ({
  isOpen,
  onClose,
  cloudConfluences,
  onLoadConfluence,
  onDeleteConfluence
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-[140] cursor-pointer"
          />

          {/* Drawer body */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] bg-[#060c17] border-l border-[#152236] shadow-2xl z-[150] flex flex-col text-xs text-[#a8c0d8]"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#152236] bg-[#090f1e] flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#00c8f0]" />
                <div>
                  <h3 className="font-syne font-extrabold text-white text-sm uppercase">Cloud Records History</h3>
                  <p className="text-[9px] text-[#4a6580] uppercase tracking-wider font-mono">Secure PostgreSQL Sync</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-[#152236] text-[#7a98b4] hover:text-white rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List area */}
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3">
              {cloudConfluences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2 select-none">
                  <Cloud className="w-10 h-10 text-[#152236]" />
                  <span className="text-[10px] font-mono text-[#4a6580] uppercase tracking-wider">No cloud back ups recorded yet.</span>
                  <p className="text-[9.5px] text-[#7a98b4] max-w-[280px] leading-relaxed">
                    Generate a top-down confluence score and click the <strong className="text-white">SAVE CLOUD</strong> button in the header bar to back up your technical reports securely.
                  </p>
                </div>
              ) : (
                cloudConfluences.map((item) => {
                  const createdDate = item.createdAt
                    ? (typeof item.createdAt === "string" ? new Date(item.createdAt).toLocaleString() : new Date(item.createdAt.seconds * 1000).toLocaleString())
                    : "Unknown date";
                  const overallBias = item.overallBias || "NEUTRAL";

                  return (
                    <div 
                      key={item.id} 
                      className="p-3 bg-[#090f1e] border border-[#152236]/80 hover:border-[#9d78f8]/40 rounded-lg flex flex-col gap-2 transition"
                    >
                      {/* Top metadata line */}
                      <div className="flex justify-between items-center border-b border-[#152236]/40 pb-2">
                        <div className="flex items-center gap-1.5 font-mono text-[8.5px]">
                          <Calendar className="w-3 h-3 text-[#4a6580]" />
                          <span className="text-white">{createdDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase ${
                            overallBias === "BULLISH" ? "bg-[#00df6e]/20 text-[#00df6e]" :
                            overallBias === "BEARISH" ? "bg-[#f03060]/20 text-[#f03060]" : "bg-[#00c8f0]/20 text-[#00c8f0]"
                          }`}>
                            {overallBias}
                          </span>
                          <span className="font-mono font-bold text-white bg-[#9d78f8]/10 border border-[#9d78f8]/30 px-1 py-0.5 rounded text-[8px]">
                            {item.confluenceScore}%
                          </span>
                        </div>
                      </div>

                      {/* Suite and details */}
                      <div className="text-[10px] flex flex-col gap-1 text-[#b8d0e8]">
                        <div className="flex items-center gap-1 font-mono text-[8.5px]">
                          <Layers className="w-3 h-3 text-[#7a98b4]" />
                          <span className="text-[#7a98b4]">Suite:</span>
                          <span className="text-white">{item.timeframeSuite?.join(", ") || "None"}</span>
                        </div>
                        {item.dominantNarrative && (
                          <p className="text-[9.5px] italic text-[#7a98b4] line-clamp-2 leading-relaxed bg-[#060c17]/60 p-1.5 rounded border border-[#152236]/30">
                            "{item.dominantNarrative}"
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 justify-end mt-1 pt-1.5 border-t border-[#152236]/30">
                        <button
                          onClick={() => onLoadConfluence(item)}
                          className="px-2.5 py-1 bg-[#00c8f0]/10 hover:bg-[#00c8f0]/20 border border-[#00c8f0]/30 hover:border-[#00c8f0] text-[#00c8f0] text-[9.5px] font-bold rounded flex items-center gap-1 transition cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          LOAD REPORT
                        </button>
                        <button
                          onClick={() => onDeleteConfluence(item.id)}
                          className="px-2 py-1 bg-[#f03060]/5 hover:bg-[#f03060]/15 border border-[#f03060]/20 hover:border-[#f03060] text-[#f03060] rounded transition cursor-pointer"
                          title="Delete cloud backup permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer summary */}
            <div className="p-3 bg-[#090f1e] border-t border-[#152236] text-center font-mono text-[8.5px] text-[#4a6580] select-none flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-[#9d78f8]" />
              SECURE CLOUD STORAGE FOR TRADING INTEL
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
