import React, { useState } from "react";
import { Settings, X, Plus, AlertTriangle, HelpCircle, Shield, Link, FileHeart, Sliders } from "lucide-react";
import { FocusMode, WebhookConfig, LogEntry } from "../types";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  keywords: string[];
  onAddKeyword: (kw: string) => void;
  onRemoveKeyword: (idx: number) => void;
  roiEnabled: boolean;
  onToggleRoi: (val: boolean) => void;
  roiX: number;
  roiY: number;
  roiW: number;
  roiH: number;
  onChangeRoiCoord: (field: "x" | "y" | "w" | "h", val: number) => void;
  webhooks: WebhookConfig[];
  onAddWebhook: (url: string, trigger: WebhookConfig["trigger"]) => void;
  onRemoveWebhook: (id: string) => void;
  onTestWebhooks: () => void;
  customFocusModes: FocusMode[];
  onAddFocusMode: (name: string, prompt: string) => void;
  onRemoveFocusMode: (id: string) => void;
  minOcrConf: number;
  setMinOcrConf: (val: number) => void;
  ocrIntervalMethod: string;
  setOcrIntervalMethod: (val: string) => void;
  onAddLog: (msg: string, type: LogEntry["type"]) => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  roiEnabled,
  onToggleRoi,
  roiX,
  roiY,
  roiW,
  roiH,
  onChangeRoiCoord,
  webhooks,
  onAddWebhook,
  onRemoveWebhook,
  onTestWebhooks,
  customFocusModes,
  onAddFocusMode,
  onRemoveFocusMode,
  minOcrConf,
  setMinOcrConf,
  ocrIntervalMethod,
  setOcrIntervalMethod,
  onAddLog,
}) => {
  // Input builders local states
  const [keywordInput, setKeywordInput] = useState<string>("");
  const [fmName, setFmName] = useState<string>("");
  const [fmPrompt, setFmPrompt] = useState<string>("");
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [webhookTrigger, setWebhookTrigger] = useState<WebhookConfig["trigger"]>("keyword");

  const handleKeywordCommit = () => {
    const val = keywordInput.trim().toLowerCase();
    if (!val) return;
    onAddKeyword(val);
    setKeywordInput("");
  };

  const handleFocusModeCommit = () => {
    const name = fmName.trim();
    const prompt = fmPrompt.trim();
    if (!name || !prompt) {
      onAddLog("Focus Mode Name and prompt instructions are required.", "error");
      return;
    }
    onAddFocusMode(name, prompt);
    setFmName("");
    setFmPrompt("");
  };

  const handleWebhookCommit = () => {
    const url = webhookUrl.trim();
    if (!url || !url.startsWith("http")) {
      onAddLog("Provide a valid absolute HTTP/HTTPS webhook target URL.", "error");
      return;
    }
    onAddWebhook(url, webhookTrigger);
    setWebhookUrl("");
  };

  return (
    <>
      {/* Slide overlay */}
      <div 
        onClick={onClose}
        className={`fixed inset-0 bg-[#03070e]/60 backdrop-blur-sm z-[100] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`} 
      />

      {/* Main slide panel */}
      <div 
        className={`fixed top-0 right-0 bottom-0 w-80 bg-[#060c17] border-l border-[#152236] z-[101] shadow-2xl flex flex-col h-full transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer custom header */}
        <div className="flex items-center justify-between p-4 bg-[#090f1e] border-b border-[#152236] text-xs font-bold font-syne tracking-wider text-[#7a98b4] uppercase">
          <span className="flex items-center gap-1.5 align-middle">
            <Settings className="w-4 h-4 text-[#00c8f0] animate-spin-slow" />
            Configurator Panel
          </span>
          <button onClick={onClose} className="text-[#4a6580] hover:text-white cursor-pointer font-bold text-lg select-none">
            ×
          </button>
        </div>

        {/* Configurations content feed */}
        <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-5 text-xs text-[#b8d0e8] select-none">
          
          {/* Section: OCR configurations */}
          <div className="flex flex-col gap-2.5 border-b border-[#152236] pb-4">
            <span className="text-[9px] font-bold text-[#4a6580] uppercase tracking-widest flex items-center gap-1 font-mono">
              <Sliders className="w-3.5 h-3.5 text-[#00c8f0]" />
              OCR Engine parameters
            </span>

            <div className="flex justify-between items-center">
              <span className="text-[#7a98b4]">OCR Frame Interval</span>
              <select
                value={ocrIntervalMethod}
                onChange={(e) => setOcrIntervalMethod(e.target.value)}
                className="bg-black border border-[#152236] px-2 py-1 rounded text-[10px] text-[#00c8f0] focus:ring-0 focus:outline-none"
              >
                <option value="adaptive">Adaptive Rate</option>
                <option value="4">Every 4 Frames</option>
                <option value="8">Every 8 Frames</option>
                <option value="16">Every 16 Frames</option>
                <option value="30">Every 30 Frames</option>
              </select>
            </div>

            <div className="flex justify-between items-center. mt-1 border-t border-[#152236]/35 pt-2">
              <span className="text-[#7a98b4] flex flex-col">
                <span>Minimum Confidence %</span>
                <span className="text-[8px] text-[#4a6580]">Ignore low accuracy scans</span>
              </span>
              <input
                type="number"
                min={0}
                max={99}
                value={minOcrConf}
                onChange={(e) => setMinOcrConf(parseInt(e.target.value) || 40)}
                className="w-12 bg-black border border-[#152236] p-1 px-1.5 rounded text-[10px] text-center focus:outline-none focus:border-[#00c8f0] font-mono text-[#00c8f0]"
              />
            </div>
          </div>

          {/* Section: ROI manual settings */}
          <div className="flex flex-col gap-2.5 border-b border-[#152236] pb-4">
            <span className="text-[9px] font-bold text-[#4a6580] uppercase tracking-widest flex items-center gap-1 font-mono">
              <Link className="w-3.5 h-3.5 text-[#00c8f0]" />
              Region of Interest Controls
            </span>

            <div className="flex justify-between items-center">
              <span className="text-[#a8c0d8]">Enable Target Boundary (ROI)</span>
              <input 
                type="checkbox"
                checked={roiEnabled}
                onChange={(e) => onToggleRoi(e.target.checked)}
                className="accent-[#00c8f0] w-3.5 h-3.5 cursor-pointer rounded"
              />
            </div>

            {roiEnabled && (
              <div className="grid grid-cols-2 gap-2 mt-1 p-2 bg-[#090f1e] border border-[#152236] rounded font-mono text-[#7a98b4]">
                <div>
                  <label className="text-[8px] uppercase text-[#4a6580]">Left (X)</label>
                  <input
                    type="number"
                    value={roiX}
                    min={0}
                    onChange={(e) => onChangeRoiCoord("x", parseInt(e.target.value) || 0)}
                    className="w-full bg-black border border-[#152236] p-1 px-1.5 rounded text-[10px] focus:outline-none focus:border-[#00c8f0] text-white"
                  />
                </div>
                <div>
                  <label className="text-[8px] uppercase text-[#4a6580]">Top (Y)</label>
                  <input
                    type="number"
                    value={roiY}
                    min={0}
                    onChange={(e) => onChangeRoiCoord("y", parseInt(e.target.value) || 0)}
                    className="w-full bg-black border border-[#152236] p-1 px-1.5 rounded text-[10px] focus:outline-none focus:border-[#00c8f0] text-white"
                  />
                </div>
                <div>
                  <label className="text-[8px] uppercase text-[#4a6580]">Width</label>
                  <input
                    type="number"
                    value={roiW}
                    min={10}
                    onChange={(e) => onChangeRoiCoord("w", parseInt(e.target.value) || 1280)}
                    className="w-full bg-black border border-[#152236] p-1 px-1.5 rounded text-[10px] focus:outline-none focus:border-[#00c8f0] text-white"
                  />
                </div>
                <div>
                  <label className="text-[8px] uppercase text-[#4a6580]">Height</label>
                  <input
                    type="number"
                    value={roiH}
                    min={10}
                    onChange={(e) => onChangeRoiCoord("h", parseInt(e.target.value) || 720)}
                    className="w-full bg-black border border-[#152236] p-1 px-1.5 rounded text-[10px] focus:outline-none focus:border-[#00c8f0] text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Alerts Keywords list */}
          <div className="flex flex-col gap-2.5 border-b border-[#152236] pb-4">
            <span className="text-[9px] font-bold text-[#4a6580] uppercase tracking-widest flex items-center gap-1 font-mono">
              <AlertTriangle className="w-3.5 h-3.5 text-[#00c8f0]" />
              Acoustic Alert Keywords
            </span>

            {/* Chip lists rendering */}
            <div className="flex flex-wrap gap-1 mb-1 max-h-16 overflow-y-auto">
              {keywords.map((kw, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full bg-[#00c8f0]/10 border border-[#00c8f0]/25 text-[#00c8f0] text-[9px] font-bold flex items-center gap-1 font-mono"
                >
                  {kw}
                  <button onClick={() => onRemoveKeyword(idx)} className="hover:text-[#f03060] font-black cursor-pointer leading-none">
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Commit watchword (e.g. BREAKOUT)"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleKeywordCommit()}
                className="flex-grow bg-[#090f1e] border border-[#152236] rounded px-2 py-1 text-[10.5px] text-white focus:outline-none focus:border-[#00c8f0]"
              />
              <button onClick={handleKeywordCommit} className="bg-[#0b1322] border border-[#152236] hover:border-[#00c8f0]/40 text-[#4a6580] hover:text-[#00c8f0] p-1 px-2 rounded shrink-0 font-bold transition">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Section: Custom Focus instructions Builder */}
          <div className="flex flex-col gap-2.5 border-b border-[#152236] pb-4">
            <span className="text-[9px] font-bold text-[#4a6580] uppercase tracking-widest flex items-center gap-1 font-mono">
              <HelpCircle className="w-3.5 h-3.5 text-[#00c8f0]" />
              Custom Gemini System Instructions
            </span>

            {/* Existed Custom list */}
            {customFocusModes.length > 0 && (
              <div className="flex flex-col gap-1 p-1 max-h-16 overflow-y-auto border border-[#152236]/40 bg-[#090f1e] rounded">
                {customFocusModes.map((mode) => (
                  <div key={mode.id} className="flex justify-between items-center text-[10px] p-1 px-1.5 bg-[#0b1322] rounded truncate">
                    <span className="text-white truncate max-w-[190px]">⚡ {mode.name}</span>
                    <button onClick={() => onRemoveFocusMode(mode.id)} className="text-[#4a6580] hover:text-[#f03060] font-bold">✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1.5 mt-1 border-t border-[#152236]/35 pt-2">
              <input
                type="text"
                placeholder="Focus Name (e.g. Options Alert)"
                value={fmName}
                onChange={(e) => setFmName(e.target.value)}
                className="bg-[#090f1e] border border-[#152236] rounded px-2 py-1 text-[10.5px] focus:outline-none focus:border-[#9d78f8]"
              />
              <textarea
                placeholder="Write specific guidelines for Gemini to obey when evaluating frame..."
                value={fmPrompt}
                onChange={(e) => setFmPrompt(e.target.value)}
                rows={2}
                className="bg-[#090f1e] border border-[#152236] rounded px-2 py-1 text-[10.5px] focus:outline-none focus:border-[#9d78f8] resize-none"
              />
              <button onClick={handleFocusModeCommit} className="w-full py-1.5 bg-[#9d78f8]/10 hover:bg-[#9d78f8]/20 border border-[#9d78f8]/35 rounded text-[#9d78f8] font-bold text-[10px] tracking-wider uppercase transition">
                Create custom instruction
              </button>
            </div>
          </div>

          {/* Section: Webhook Trigger Pipeline */}
          <div className="flex flex-col gap-2.5 pb-2">
            <span className="text-[9px] font-bold text-[#4a6580] uppercase tracking-widest flex items-center gap-1 font-mono">
              <Shield className="w-3.5 h-3.5 text-[#00c8f0]" />
              Automated Webhook pipelines
            </span>

            {/* List webhooks */}
            {webhooks.length > 0 && (
              <div className="flex flex-col gap-1 p-1 max-h-20 overflow-y-auto border border-[#152236]/40 bg-[#090f1e] rounded">
                {webhooks.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-[10px] p-1 px-1.5 bg-[#0b1322] rounded">
                    <span className="text-[#a8c0d8] truncate max-w-[130px]" title={item.url}>{item.url}</span>
                    <span className="text-[8px] bg-black/40 px-1 border border-[#152236] rounded text-[#4a6580] uppercase">{item.trigger}</span>
                    <button onClick={() => onRemoveWebhook(item.id)} className="text-[#4a6580] hover:text-[#f03060] font-bold ml-1">✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1.5 mt-1 border-t border-[#152236]/35 pt-2">
              <input
                type="text"
                placeholder="https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="bg-[#090f1e] border border-[#152236] rounded px-2 py-1 text-[10.5px] focus:outline-none focus:border-[#00c8f0]"
              />
              <div className="flex gap-1.5">
                <select
                  value={webhookTrigger}
                  onChange={(e) => setWebhookTrigger(e.target.value as any)}
                  className="bg-[#090f1e] border border-[#152236] rounded p-1 text-[10px] flex-grow text-[#7a98b4]"
                >
                  <option value="keyword">On Acoustic Word Alert</option>
                  <option value="analysis">On AI Report Complete</option>
                  <option value="high">On High Delta Motion</option>
                  <option value="all">Publish All Events</option>
                </select>
                <button onClick={handleWebhookCommit} className="bg-[#0b1322] border border-[#152236] hover:border-[#00c8f0]/40 text-[#00c8f0] p-1 px-3.5 rounded shrink-0 font-bold font-sans text-[10px]">
                  Add
                </button>
              </div>

              {webhooks.length > 0 && (
                <button
                  onClick={onTestWebhooks}
                  className="w-full mt-1.5 py-1.5 bg-[#00df6e]/5 hover:bg-[#00df6e]/10 border border-[#00df6e]/30 rounded text-[#00df6e] font-bold text-[10px] tracking-wider uppercase transition"
                >
                  Test Fire Webhooks
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
