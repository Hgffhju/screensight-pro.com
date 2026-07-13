import React, { useState, useEffect } from "react";
import { 
  Mail, 
  Send, 
  Inbox, 
  FileText, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Sparkles, 
  X, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Check,
  Plus,
  ArrowRight
} from "lucide-react";
import { LogEntry } from "../types";
import { ConfluenceResult, TimeframeAnalysis } from "./MultiTimeframeEngine";

interface GmailPanelProps {
  accessToken: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => void;
  currentUser: any;
  confluenceResult: ConfluenceResult | null;
  mtfAnalyses: Record<string, TimeframeAnalysis>;
  onAddLog: (msg: string, type: LogEntry["type"]) => void;
  onInjectContext?: (text: string) => void;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
}

export const GmailPanel: React.FC<GmailPanelProps> = ({
  accessToken,
  onSignIn,
  onSignOut,
  currentUser,
  confluenceResult,
  mtfAnalyses,
  onAddLog,
  onInjectContext
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"inbox" | "send">("inbox");
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("subject:(alert OR signal OR trading OR economic OR market)");
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);

  // Email Composer states
  const [recipient, setRecipient] = useState<string>("");
  const [customSubject, setCustomSubject] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [includeAnalyses, setIncludeAnalyses] = useState<boolean>(true);
  const [includeTacticalPlan, setIncludeTacticalPlan] = useState<boolean>(true);
  const [emailSending, setEmailSending] = useState<boolean>(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState<boolean>(false);

  // Safety Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: "send" | "draft";
    recipient: string;
    subject: string;
  }>({
    show: false,
    type: "send",
    recipient: "",
    subject: ""
  });

  // Load message detail
  const fetchMessages = async () => {
    if (!accessToken) return;
    setLoadingMessages(true);
    try {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5${
        searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""
      }`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        throw new Error(`Gmail API returned status ${res.status}`);
      }

      const listData = await res.json();
      if (!listData.messages || listData.messages.length === 0) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      // Fetch message details in parallel
      const detailedMsgs = await Promise.all(
        listData.messages.map(async (m: any) => {
          try {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!detailRes.ok) return null;
            const detail = await detailRes.json();
            
            const headers = detail.payload?.headers || [];
            const getHeader = (name: string) => {
              const h = headers.find((item: any) => item.name.toLowerCase() === name.toLowerCase());
              return h ? h.value : "";
            };

            return {
              id: detail.id,
              threadId: detail.threadId,
              snippet: detail.snippet || "",
              subject: getHeader("Subject") || "(No Subject)",
              from: getHeader("From") || "Unknown Sender",
              date: getHeader("Date") || ""
            };
          } catch {
            return null;
          }
        })
      );

      const validMsgs = detailedMsgs.filter((m): m is GmailMessage => m !== null);
      setMessages(validMsgs);
      onAddLog(`Gmail API: Synced ${validMsgs.length} messages based on custom scan parameters.`, "success");
    } catch (error: any) {
      console.error("Error fetching Gmail messages:", error);
      onAddLog(`Gmail Fetch Failed: ${error.message}`, "error");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (accessToken && activeTab === "inbox") {
      fetchMessages();
    }
  }, [accessToken, activeTab, searchQuery]);

  // Set default subject and message body when confluence result changes
  useEffect(() => {
    if (confluenceResult) {
      setCustomSubject(`ScreenSight Pro: ${confluenceResult.overallBias.toUpperCase()} Confluence Alert - ${confluenceResult.confluenceScore}% Match`);
      
      const tacticalText = confluenceResult.tacticalEntryPlan ? `
=== TACTICAL TRADE EXECUTION PLAN ===
• Trigger: ${confluenceResult.tacticalEntryPlan.entryTrigger}
• Stop Loss: ${confluenceResult.tacticalEntryPlan.stopLoss}
• Take Profit: ${confluenceResult.tacticalEntryPlan.takeProfit}
• Risk/Reward: ${confluenceResult.tacticalEntryPlan.riskRewardRatio}
• Strategy: ${confluenceResult.tacticalEntryPlan.executionStrategy}
      `.trim() : "";

      const body = `
Trader Confluence Summary dispatched via ScreenSight Pro.

Overall market narrative shows a strong ${confluenceResult.overallBias.toUpperCase()} bias matching ${confluenceResult.confluenceScore}% indicator confluence.

Dominant Narrative:
"${confluenceResult.dominantNarrative}"

Aligned Timeframes: ${confluenceResult.alignedTimeframes.join(", ") || "None"}
Conflicting Timeframes: ${confluenceResult.conflictingTimeframes.join(", ") || "None"}

${tacticalText}

Generated on ${new Date().toLocaleString()}
`.trim();

      setCustomMessage(body);
    }
  }, [confluenceResult]);

  // Helper to build MIME raw email
  const buildRawMimeEmail = (to: string, subject: string, bodyText: string) => {
    // Generate styled HTML wrapper for professional trading looks
    const overallBiasColor = confluenceResult?.overallBias.toLowerCase() === "bullish" ? "#00df6e" : 
                             confluenceResult?.overallBias.toLowerCase() === "bearish" ? "#f03060" : "#00c8f0";

    const formattedTfRows = Object.entries(mtfAnalyses).map(([tf, anal]) => {
      const a = anal as TimeframeAnalysis;
      return `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 8px; font-weight: bold; color: #f8fafc;">${tf}</td>
          <td style="padding: 8px;"><span style="background: ${a.bias.toLowerCase() === 'bullish' ? 'rgba(0, 223, 110, 0.15)' : 'rgba(240, 48, 96, 0.15)'}; color: ${a.bias.toLowerCase() === 'bullish' ? '#00df6e' : '#f03060'}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">${a.bias.toUpperCase()}</span></td>
          <td style="padding: 8px; color: #94a3b8; font-size: 12px;">${a.trend}</td>
          <td style="padding: 8px; color: #cbd5e1; font-size: 12px;">${a.summary}</td>
        </tr>
      `;
    }).join("");

    const htmlBody = `
      <div style="background-color: #030712; color: #f1f5f9; font-family: 'Inter', sans-serif; padding: 24px; border-radius: 8px; border: 1px solid #1e293b; max-width: 600px; margin: 0 auto;">
        <div style="border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 16px;">
          <h2 style="color: #00c8f0; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">ScreenSight Pro</h2>
          <p style="color: #64748b; font-size: 10px; text-transform: uppercase; margin: 4px 0 0 0; font-family: monospace;">Top-Down Confluence Intelligence</p>
        </div>

        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #1e293b; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 12px; font-weight: bold; color: #94a3b8; text-transform: uppercase; tracking-wider;">Market Confluence Matrix</span>
            <span style="background: ${overallBiasColor}1A; border: 1px solid ${overallBiasColor}3F; color: ${overallBiasColor}; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 900; text-transform: uppercase;">
              ${confluenceResult?.overallBias || "NEUTRAL"}
            </span>
          </div>

          <div style="font-size: 28px; font-weight: 900; color: #f8fafc; margin-bottom: 10px;">
            ${confluenceResult?.confluenceScore || 50}% <span style="font-size: 14px; color: #64748b; font-weight: normal;">Confluence Score</span>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1; margin: 0;">
            <strong>Dominant Narrative:</strong> ${confluenceResult?.dominantNarrative || "No narrative established yet."}
          </p>
        </div>

        ${includeTacticalPlan && confluenceResult?.tacticalEntryPlan ? `
        <div style="background: rgba(157, 120, 248, 0.08); border: 1px solid rgba(157, 120, 248, 0.2); padding: 16px; border-radius: 6px; margin-bottom: 20px;">
          <h3 style="color: #a78bfa; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; font-weight: 800; border-bottom: 1px solid rgba(157, 120, 248, 0.15); padding-bottom: 6px;">Tactical Trade Setup</h3>
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #94a3b8; width: 35%;">Trigger Signal:</td>
              <td style="padding: 4px 0; color: #f8fafc; font-weight: bold;">${confluenceResult.tacticalEntryPlan.entryTrigger}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #94a3b8;">Stop Loss Zone:</td>
              <td style="padding: 4px 0; color: #f8fafc; font-weight: bold; color: #f03060;">${confluenceResult.tacticalEntryPlan.stopLoss}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #94a3b8;">Take Profit Targets:</td>
              <td style="padding: 4px 0; color: #f8fafc; font-weight: bold; color: #00df6e;">${confluenceResult.tacticalEntryPlan.takeProfit}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #94a3b8;">Risk to Reward:</td>
              <td style="padding: 4px 0; color: #cbd5e1; font-weight: bold;">${confluenceResult.tacticalEntryPlan.riskRewardRatio}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0 0 0; color: #94a3b8; vertical-align: top;">Strategy:</td>
              <td style="padding: 6px 0 0 0; color: #cbd5e1; font-style: italic;">${confluenceResult.tacticalEntryPlan.executionStrategy}</td>
            </tr>
          </table>
        </div>
        ` : ""}

        ${includeAnalyses && Object.keys(mtfAnalyses).length > 0 ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #00c8f0; margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; font-weight: 800;">Scrutinized Timeframe Suite</h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left; border: 1px solid #1e293b; border-radius: 4px; overflow: hidden;">
            <thead>
              <tr style="background-color: #0f172a; border-bottom: 1px solid #1e293b;">
                <th style="padding: 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">TF</th>
                <th style="padding: 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">Bias</th>
                <th style="padding: 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">Trend</th>
                <th style="padding: 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">Key Insight</th>
              </tr>
            </thead>
            <tbody>
              ${formattedTfRows}
            </tbody>
          </table>
        </div>
        ` : ""}

        <div style="border-t: 1px solid #1e293b; padding-top: 14px; margin-top: 24px;">
          <p style="white-space: pre-wrap; font-size: 12.5px; line-height: 1.6; color: #a0aec0; background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 4px; border: 1px solid #0f172a; margin-top: 0;">${bodyText.replace(/\n/g, "<br/>")}</p>
        </div>

        <div style="border-top: 1px solid #1e293b; margin-top: 24px; padding-top: 12px; text-align: center;">
          <p style="color: #475569; font-size: 10px; margin: 0;">
            This email was compiled and dispatched via ScreenSight Pro secure trading console.
          </p>
          <p style="color: #475569; font-size: 9px; margin: 4px 0 0 0; font-family: monospace;">
            STRICTLY CONFIDENTIAL · ACCREDITED TRADER AUDIT
          </p>
        </div>
      </div>
    `;

    const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
    const emailParts = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "",
      htmlBody
    ];

    const email = emailParts.join("\r\n");
    // Standard Base64Url encoding
    const base64 = btoa(unescape(encodeURIComponent(email)));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  // Perform actual API actions after user confirmed in custom confirmation modal
  const handleConfirmedOperation = async () => {
    const { type, recipient: rec, subject: subj } = confirmModal;
    setConfirmModal(prev => ({ ...prev, show: false }));
    
    if (!accessToken) return;
    setEmailSending(true);
    setEmailSentSuccess(false);

    try {
      const rawEmail = buildRawMimeEmail(rec, subj, customMessage);
      let url = "";
      let options: any = {};

      if (type === "send") {
        url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
        options = {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ raw: rawEmail })
        };
        onAddLog(`Gmail API: Initiating message dispatch to ${rec}...`, "info");
      } else {
        url = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
        options = {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: { raw: rawEmail }
          })
        };
        onAddLog(`Gmail API: Creating new confluence draft...`, "info");
      }

      const res = await fetch(url, options);
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error?.message || `Gmail API returned ${res.status}`);
      }

      setEmailSentSuccess(true);
      if (type === "send") {
        onAddLog(`Gmail API: Report dispatched successfully to ${rec}!`, "success");
      } else {
        onAddLog(`Gmail API: Confluence draft successfully saved in your inbox drafts folder.`, "success");
      }

      // Reset states
      setTimeout(() => {
        setEmailSentSuccess(false);
      }, 5000);
    } catch (err: any) {
      console.error("Gmail Operation Error:", err);
      onAddLog(`Gmail Dispatch Failed: ${err.message}`, "error");
    } finally {
      setEmailSending(false);
    }
  };

  // Trigger Confirmation Modal for draft/sending
  const triggerOperationWithConfirmation = (opType: "send" | "draft") => {
    const targetRecipient = opType === "send" ? recipient : currentUser?.email || "me";
    if (opType === "send" && (!recipient || !recipient.includes("@"))) {
      onAddLog("Validation Error: Please specify a valid recipient email address.", "error");
      return;
    }

    setConfirmModal({
      show: true,
      type: opType,
      recipient: targetRecipient,
      subject: customSubject || "ScreenSight Confluence Report"
    });
  };

  return (
    <div className="border-b border-[#152236] text-xs">
      {/* Header section toggle */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-[#090f1e]/40 flex items-center justify-between cursor-pointer select-none hover:bg-[#090f1e]/80 transition"
      >
        <div className="flex items-center gap-1.5 font-syne">
          <Mail className="w-4 h-4 text-[#00c8f0] animate-pulse" />
          <span className="font-extrabold text-white text-[10px] tracking-wider uppercase">Gmail Workspace Console</span>
        </div>
        <div className="flex items-center gap-1.5">
          {accessToken && (
            <span className="w-2 h-2 rounded-full bg-[#00df6e] shadow-[0_0_8px_#00df6e]" title="Gmail OAuth Authorized" />
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-[#4a6580]" /> : <ChevronDown className="w-4 h-4 text-[#4a6580]" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-3 bg-[#060c17]/30 flex flex-col gap-3">
          {/* Connection management banner */}
          {!accessToken ? (
            <div className="p-3 border border-[#152236] bg-[#090f1e]/80 rounded text-center">
              <Mail className="w-8 h-8 text-[#4a6580] mx-auto mb-2" />
              <h4 className="font-bold text-white text-xs mb-1">Connect Gmail Inbox</h4>
              <p className="text-[10px] text-[#7a98b4] mb-3 leading-relaxed">
                Unlock real-time news alerts, newsletter analysis, and top-down report sharing.
              </p>
              <button
                onClick={onSignIn}
                className="w-full py-1.5 bg-[#00c8f0]/15 hover:bg-[#00c8f0]/25 border border-[#00c8f0]/30 rounded text-[#00c8f0] text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect Google Account
              </button>
            </div>
          ) : (
            <>
              {/* Connected Account header */}
              <div className="flex items-center justify-between p-2 bg-[#090f1e]/60 border border-[#152236] rounded">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#00c8f0]/15 flex items-center justify-center text-[#00c8f0] font-bold text-[9px]">
                    {currentUser?.photoURL ? (
                      <img src={currentUser.photoURL} className="w-5 h-5 rounded-full" alt="profile" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white font-bold truncate max-w-[170px]">
                      {currentUser?.displayName || "Connected Trader"}
                    </span>
                    <span className="text-[8px] text-[#4a6580] truncate max-w-[170px]">
                      {currentUser?.email || "Gmail Active"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onSignOut}
                  className="px-2 py-0.5 border border-[#f03060]/30 hover:border-[#f03060]/60 bg-[#f03060]/5 text-[#f03060] font-mono text-[8.5px] rounded transition cursor-pointer"
                  title="Disconnect Gmail scope"
                >
                  DISCONNECT
                </button>
              </div>

              {/* Tabs list */}
              <div className="grid grid-cols-2 gap-1 border-b border-[#152236] pb-1">
                <button
                  onClick={() => setActiveTab("inbox")}
                  className={`py-1 text-[9.5px] font-extrabold uppercase tracking-wide border-b-2 text-center transition cursor-pointer ${
                    activeTab === "inbox"
                      ? "border-[#00c8f0] text-[#00c8f0]"
                      : "border-transparent text-[#7a98b4] hover:text-white"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    <Inbox className="w-3.5 h-3.5" />
                    Inbox Scan ({messages.length})
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("send")}
                  className={`py-1 text-[9.5px] font-extrabold uppercase tracking-wide border-b-2 text-center transition cursor-pointer ${
                    activeTab === "send"
                      ? "border-[#00c8f0] text-[#00c8f0]"
                      : "border-transparent text-[#7a98b4] hover:text-white"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    <Send className="w-3.5 h-3.5" />
                    Email Report
                  </span>
                </button>
              </div>

              {/* Tab Contents: Inbox Scanner */}
              {activeTab === "inbox" && (
                <div className="flex flex-col gap-2">
                  {/* Search query customization bar */}
                  <div className="flex items-center gap-1 bg-[#090f1e] border border-[#152236] p-1.5 rounded">
                    <Search className="w-3.5 h-3.5 text-[#4a6580] shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. subject:(alert OR signals)"
                      className="bg-transparent text-[10px] text-[#cbd5e1] font-mono focus:outline-none flex-grow"
                      title="Press Refresh to search with customized parameters"
                    />
                    <button
                      onClick={fetchMessages}
                      disabled={loadingMessages}
                      className="p-1 hover:bg-[#152236] text-[#00c8f0] rounded cursor-pointer disabled:opacity-30"
                      title="Sync recent emails"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingMessages ? "animate-spin text-white" : ""}`} />
                    </button>
                  </div>

                  {/* Suggest Quick Filters */}
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {[
                      { label: "All Alerts", q: "subject:(alert OR signal OR trading OR economic OR market)" },
                      { label: "Newsletters", q: "subject:(newsletter OR market update OR macro)" },
                      { label: "BTC/Crypto", q: "BTC OR Bitcoin OR crypto" },
                    ].map((filt, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSearchQuery(filt.q)}
                        className={`px-1.5 py-0.5 border rounded-full text-[8px] font-bold transition shrink-0 cursor-pointer ${
                          searchQuery === filt.q
                            ? "bg-[#00c8f0]/10 border-[#00c8f0] text-[#00c8f0]"
                            : "bg-[#090f1e]/50 border-[#152236] text-[#7a98b4] hover:text-white"
                        }`}
                      >
                        {filt.label}
                      </button>
                    ))}
                  </div>

                  {/* Messages List Area */}
                  {loadingMessages ? (
                    <div className="p-6 text-center text-[#7a98b4] flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#00c8f0]" />
                      <span className="font-mono text-[9px] uppercase tracking-wider">Retrieving Gmail records...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-6 text-center border border-[#152236]/30 bg-[#090f1e]/20 rounded flex flex-col items-center justify-center">
                      <Inbox className="w-6 h-6 text-[#4a6580] mb-1" />
                      <span className="text-[10px] font-bold text-[#7a98b4]">No matching emails detected</span>
                      <p className="text-[8.5px] text-[#4a6580] mt-0.5 leading-relaxed">
                        Try modifying the search filter query above or refresh.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          onClick={() => setSelectedMessage(selectedMessage?.id === msg.id ? null : msg)}
                          className={`p-2 border rounded cursor-pointer transition flex flex-col gap-1 ${
                            selectedMessage?.id === msg.id
                              ? "bg-[#00c8f0]/5 border-[#00c8f0] shadow-[0_0_10px_rgba(0,200,240,0.15)]"
                              : "bg-[#090f1e]/40 border-[#152236] hover:border-[#4a6580]/50"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-extrabold text-[10px] text-white truncate max-w-[190px]">
                              {msg.subject}
                            </span>
                            <span className="text-[8px] text-[#4a6580] font-mono shrink-0">
                              {msg.date ? msg.date.split(" ").slice(1,4).join(" ") : ""}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center text-[8.5px] text-[#7a98b4]">
                            <span className="truncate max-w-[160px]">From: {msg.from.replace(/<.*>/, "")}</span>
                          </div>

                          <p className="text-[9.5px] text-[#4a6580] leading-snug line-clamp-2 mt-0.5">
                            {msg.snippet}
                          </p>

                          {selectedMessage?.id === msg.id && (
                            <div className="border-t border-[#152236]/50 pt-2 mt-1 flex flex-col gap-1.5 animate-fadeIn">
                              <div className="p-1.5 bg-[#030712] rounded border border-[#152236] text-[9.5px] leading-relaxed text-[#b8d0e8] font-mono select-text whitespace-pre-wrap max-h-24 overflow-y-auto">
                                <strong>Message Context:</strong>
                                <br />
                                {msg.snippet}...
                              </div>
                              
                              {onInjectContext && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onInjectContext(`GMAIL ALERT Context (From: ${msg.from}): ${msg.snippet}`);
                                    onAddLog("Successfully injected selected Gmail alert content into local workspace context.", "success");
                                  }}
                                  className="py-1 bg-[#00c8f0]/10 hover:bg-[#00c8f0]/20 border border-[#00c8f0]/30 hover:border-[#00c8f0] text-[#00c8f0] text-[9px] font-bold rounded flex items-center justify-center gap-1 transition"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Inject into AI OCR Buffer
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab Contents: Send Confluence Report */}
              {activeTab === "send" && (
                <div className="flex flex-col gap-2 font-sans text-xs">
                  {!confluenceResult ? (
                    <div className="p-4 text-center border border-[#152236]/30 bg-[#090f1e]/20 rounded">
                      <AlertCircle className="w-6 h-6 text-[#9d78f8] mx-auto mb-1 animate-bounce" />
                      <span className="font-bold text-white text-[10.5px]">No Live Confluence Data Found</span>
                      <p className="text-[8.5px] text-[#7a98b4] mt-1 leading-relaxed">
                        Please initiate the <strong>Confluence Engine</strong> in the section above to generate and synthesize market data before dispatching.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {/* Recipient Input */}
                      <div>
                        <span className="text-[9px] font-mono text-[#4a6580] uppercase block mb-1">Recipient Email Address</span>
                        <input
                          type="email"
                          placeholder="client@tradingdesk.com"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          className="w-full bg-[#090f1e] text-white border border-[#152236] focus:border-[#00c8f0] rounded p-1.5 focus:outline-none font-bold text-[10.5px]"
                        />
                      </div>

                      {/* Subject Field */}
                      <div>
                        <span className="text-[9px] font-mono text-[#4a6580] uppercase block mb-1">Subject Header</span>
                        <input
                          type="text"
                          placeholder="ScreenSight Confluence Summary Alert"
                          value={customSubject}
                          onChange={(e) => setCustomSubject(e.target.value)}
                          className="w-full bg-[#090f1e] text-white border border-[#152236] focus:border-[#00c8f0] rounded p-1.5 focus:outline-none text-[10.5px]"
                        />
                      </div>

                      {/* Summary Text Content Body */}
                      <div>
                        <span className="text-[9px] font-mono text-[#4a6580] uppercase block mb-1">Optional Trader Annotations</span>
                        <textarea
                          rows={3}
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          className="w-full bg-[#090f1e] text-white border border-[#152236] focus:border-[#00c8f0] rounded p-1.5 focus:outline-none text-[10px] font-mono leading-relaxed"
                        />
                      </div>

                      {/* Include Toggles */}
                      <div className="grid grid-cols-2 gap-2 p-2 bg-[#090f1e]/40 border border-[#152236]/50 rounded font-mono text-[8.5px] text-[#7a98b4]">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeTacticalPlan}
                            onChange={(e) => setIncludeTacticalPlan(e.checked || e.target.checked)}
                            className="accent-[#00c8f0] rounded cursor-pointer"
                          />
                          Include Tactical Plan
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeAnalyses}
                            onChange={(e) => setIncludeAnalyses(e.checked || e.target.checked)}
                            className="accent-[#00c8f0] rounded cursor-pointer"
                          />
                          Include Mtf Suite
                        </label>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          onClick={() => triggerOperationWithConfirmation("draft")}
                          disabled={emailSending}
                          className="py-1.5 bg-[#152236] hover:bg-[#1e2d42] border border-[#2d3e54] text-[#cbd5e1] text-[9.5px] font-bold rounded cursor-pointer transition disabled:opacity-30"
                        >
                          SAVE DRAFT
                        </button>
                        <button
                          onClick={() => triggerOperationWithConfirmation("send")}
                          disabled={emailSending}
                          className="py-1.5 bg-[#00df6e]/10 hover:bg-[#00df6e]/20 border border-[#00df6e]/40 hover:border-[#00df6e] text-[#00df6e] text-[9.5px] font-extrabold rounded tracking-wider transition disabled:opacity-30 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          SEND EMAIL
                        </button>
                      </div>

                      {emailSentSuccess && (
                        <div className="p-2 border border-[#00df6e]/30 bg-[#00df6e]/5 rounded flex items-center gap-1.5 text-[#00df6e] font-mono text-[9px] animate-fadeIn">
                          <CheckCircle2 className="w-4 h-4 text-[#00df6e]" />
                          <span>Operation completed successfully!</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Explicit Workspace Safety Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 font-sans select-none animate-fadeIn">
          <div className="bg-[#060c17] border border-[#152236] p-4 rounded-lg flex flex-col gap-3.5 max-w-sm w-full shadow-2xl relative">
            <div className="flex items-center gap-2 text-white">
              <Mail className="w-5 h-5 text-[#00c8f0]" />
              <h3 className="font-syne font-extrabold text-sm uppercase">Gmail Operation Safety Guard</h3>
            </div>
            
            <p className="text-xs text-[#cbd5e1] leading-relaxed">
              You are about to execute a Google Workspace operation. Please confirm the details below:
            </p>

            <div className="p-2.5 bg-[#090f1e] border border-[#152236] rounded text-[10.5px] font-mono flex flex-col gap-1.5 text-white">
              <div className="flex justify-between">
                <span className="text-[#4a6580] uppercase text-[9px]">Action Type:</span>
                <span className={`font-bold uppercase ${confirmModal.type === "send" ? "text-[#00df6e]" : "text-[#9d78f8]"}`}>
                  {confirmModal.type === "send" ? "DISPATCH EMAIL REPORT" : "SAVE TO DRAFTS"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#4a6580] uppercase text-[9px] shrink-0">Recipient:</span>
                <span className="font-bold truncate max-w-[200px]">{confirmModal.recipient}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#4a6580] uppercase text-[9px] shrink-0">Subject:</span>
                <span className="font-bold truncate max-w-[200px]">{confirmModal.subject}</span>
              </div>
            </div>

            <div className="text-[10px] text-[#f03060]/90 leading-tight italic bg-[#f03060]/5 p-2 rounded border border-[#f03060]/10 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-[#f03060] shrink-0" />
              <span>
                By confirming, this application will authenticate and interact with your Gmail mailbox to compose and send/save this report.
              </span>
            </div>

            <div className="flex gap-2.5 justify-end mt-1">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                className="px-4 py-1.5 bg-[#152236] text-[#cbd5e1] text-[10.5px] font-bold rounded cursor-pointer transition hover:bg-[#1e2d42]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedOperation}
                className="px-4 py-1.5 bg-[#00df6e] text-black text-[10.5px] font-extrabold rounded cursor-pointer transition hover:brightness-110 flex items-center gap-1"
              >
                Confirm Setup
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
