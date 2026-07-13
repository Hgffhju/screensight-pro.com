import React, { useState, useEffect, useRef } from "react";
import { Users, Copy, MessageSquare, ScreenShare, Share2, Compass, AlertCircle } from "lucide-react";
import { LogEntry } from "../types";

interface TeamPanelProps {
  onAddLog: (msg: string, type: LogEntry["type"]) => void;
  onSharedImageReceived: (dataUrl: string) => void;
  onSharedAIReceived: (text: string) => void;
  latestOcr: string;
  latestAI: string;
  getScreenshot: () => string | null;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({
  onAddLog,
  onSharedImageReceived,
  onSharedAIReceived,
  latestOcr,
  latestAI,
  getScreenshot,
}) => {
  const [roomCode, setRoomCode] = useState<string>("");
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem("screensight_team_name") || `Analyst_${Math.floor(Math.random() * 9000 + 1000)}`;
  });
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [showJoinRow, setShowJoinRow] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("Not connected");

  // WebRTC PeerJS structures
  const peerRef = useRef<any>(null);
  const connectionsRef = useRef<{ [peerId: string]: any }>({});
  const [activePeers, setActivePeers] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; ts: string; image?: string }[]>([]);
  const [chatInput, setChatInput] = useState<string>("");

  useEffect(() => {
    localStorage.setItem("screensight_team_name", userName);
  }, [userName]);

  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, []);

  const getPeerJSClass = () => {
    return (window as any).Peer;
  };

  const initPeer = (onOpenCallback: (id: string) => void) => {
    const PeerClass = getPeerJSClass();
    if (!PeerClass) {
      onAddLog("WebRTC PeerJS module is not yet loaded in browser head.", "error");
      setConnectionStatus("PeerJS Library Missing");
      return null;
    }

    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }

    const peer = new PeerClass(undefined, {
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("open", (id: string) => {
      onOpenCallback(id);
    });

    peer.on("error", (err: any) => {
      console.error("WebRTC node error:", err);
      onAddLog(`P2P Connection Error: ${err.type}`, "error");
      setConnectionStatus(`Error: ${err.type}`);
    });

    peer.on("disconnected", () => {
      setConnectionStatus("Reconnecting...");
      peer.reconnect();
    });

    peerRef.current = peer;
    return peer;
  };

  const handleCreateRoom = () => {
    setConnectionStatus("Creating Room...");
    const peerInstance = initPeer((id) => {
      setRoomCode(id);
      setRole("host");
      setConnectionStatus("Hosting — Awaiting Peers...");
      setActivePeers([userName + " (You)"]);
      onAddLog(`Hosted local P2P Channel: ${id.slice(0, 16)}`, "success");

      peerInstance.on("connection", (conn: any) => {
        setupIncomingConnection(conn);
      });
    });
  };

  const setupIncomingConnection = (conn: any) => {
    conn.on("open", () => {
      const guestName = conn.metadata?.name || conn.peer.slice(0, 8);
      connectionsRef.current[conn.peer] = conn;
      setActivePeers((prev) => [...prev, guestName]);
      onAddLog(`Companion [${guestName}] successfully synced.`, "success");

      // Transmit name
      conn.send({ type: "identity", name: userName });
    });

    conn.on("data", (data: any) => {
      handleIncomingData(data);
    });

    conn.on("close", () => {
      const guestName = conn.metadata?.name || "Peer";
      delete connectionsRef.current[conn.peer];
      setActivePeers((prev) => prev.filter((p) => p !== guestName));
      onAddLog(`Companion [${guestName}] left room.`, "info");
    });
  };

  const handleJoinRoom = () => {
    const targetCode = joinCodeInput.trim();
    if (!targetCode) {
      onAddLog("Please provide target P2P Room ID.", "error");
      return;
    }

    setConnectionStatus("Connecting to Host...");
    const peerInstance = initPeer((id) => {
      setRoomCode(targetCode);
      setRole("guest");
      setShowJoinRow(false);

      const conn = peerInstance.connect(targetCode, {
        metadata: { name: userName },
      });

      conn.on("open", () => {
        connectionsRef.current[targetCode] = conn;
        setConnectionStatus("Guest — Connected");
        setActivePeers([userName + " (You)", `Host [${targetCode.slice(0, 6)}]`]);
        onAddLog("Connected successfully to P2P Host.", "success");
      });

      conn.on("data", (data: any) => {
        handleIncomingData(data);
      });

      conn.on("close", () => {
        setConnectionStatus("Disconnected");
        onAddLog("Host closed connection channel.", "error");
        leaveRoom();
      });
    });
  };

  const handleIncomingData = (data: any) => {
    const senderStr = data.name || "Remote Tracker";
    const tsStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    switch (data.type) {
      case "identity":
        setActivePeers((prev) => {
          const clean = prev.filter((p) => !p.startsWith("Host"));
          if (!clean.includes(senderStr)) return [...clean, senderStr];
          return clean;
        });
        break;
      case "chat":
        setChatMessages((prev) => [
          ...prev,
          { id: Math.random().toString(), sender: senderStr, text: data.text, ts: tsStr },
        ]);
        break;
      case "frame":
        setChatMessages((prev) => [
          ...prev,
          { id: Math.random().toString(), sender: senderStr, text: "[Shared Screen Frame]", ts: tsStr, image: data.dataUrl },
        ]);
        onSharedImageReceived(data.dataUrl);
        onAddLog(`Screen frame shared by ${senderStr}`, "info");
        break;
      case "ai":
        setChatMessages((prev) => [
          ...prev,
          { id: Math.random().toString(), sender: senderStr, text: `[Shared AI Analysis]: ${data.text.slice(0, 100)}...`, ts: tsStr },
        ]);
        onSharedAIReceived(data.text);
        onAddLog(`AI analysis received from ${senderStr}`, "info");
        break;
    }
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text) return;

    const tsStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const payload = { type: "chat", name: userName, text };

    broadcastPayload(payload);
    setChatMessages((prev) => [...prev, { id: Math.random().toString(), sender: userName + " (You)", text, ts: tsStr }]);
    setChatInput("");
  };

  const broadcastPayload = (payload: any) => {
    Object.values(connectionsRef.current).forEach((conn: any) => {
      if (conn.open) {
        conn.send(payload);
      }
    });
  };

  const shareScreenCapture = () => {
    const screenshot = getScreenshot();
    if (!screenshot) {
      onAddLog("Start canvas capture first to broadcast screenshot.", "error");
      return;
    }

    const tsStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const payload = { type: "frame", name: userName, dataUrl: screenshot };

    broadcastPayload(payload);
    setChatMessages((prev) => [
      ...prev,
      { id: Math.random().toString(), sender: userName + " (You)", text: "[You Shared Screenshot]", ts: tsStr, image: screenshot },
    ]);
    onAddLog("Shared screen frame broadcasted to synchronized peers.", "info");
  };

  const shareAIResult = () => {
    if (!latestAI) {
      onAddLog("No active Gemini analysis exists to share.", "error");
      return;
    }

    const tsStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const payload = { type: "ai", name: userName, text: latestAI };

    broadcastPayload(payload);
    setChatMessages((prev) => [
      ...prev,
      { id: Math.random().toString(), sender: userName + " (You)", text: `[You Shared AI analysis]: ${latestAI.slice(0, 100)}...`, ts: tsStr },
    ]);
    onAddLog("Shared latest Gemini report with peer group.", "info");
  };

  const copyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    onAddLog("Synchronized Room credentials copied.", "info");
  };

  const leaveRoom = () => {
    Object.values(connectionsRef.current).forEach((conn: any) => {
      try {
        conn.close();
      } catch (_) {}
    });
    connectionsRef.current = {};

    if (peerRef.current && !peerRef.current.destroyed) {
      try {
        peerRef.current.destroy();
      } catch (_) {}
      peerRef.current = null;
    }

    setRoomCode("");
    setRole(null);
    setConnectionStatus("Not connected");
    setActivePeers([]);
    setChatMessages([]);
  };

  return (
    <div className="border-b border-[#152236] p-3 text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-semibold tracking-wider text-[#4a6580] uppercase flex items-center gap-1.5 font-syne">
          <Users className="w-3.5 h-3.5 text-[#00c8f0]" />
          Remote Team P2P Room
        </span>
        <div className="flex gap-1.5">
          {!role ? (
            <>
              <button
                onClick={handleCreateRoom}
                className="px-2 py-0.5 bg-[#00c8f0]/10 border border-[#00c8f0]/20 hover:border-[#00c8f0]/40 text-[#00c8f0] font-sans font-bold text-[9.5px] rounded transition"
              >
                Host
              </button>
              <button
                onClick={() => setShowJoinRow((prev) => !prev)}
                className="px-2 py-0.5 bg-[#0b1322] border border-[#152236] text-[#b8d0e8] hover:text-white font-sans font-bold text-[9.5px] rounded transition"
              >
                Join
              </button>
            </>
          ) : (
            <button
              onClick={leaveRoom}
              className="px-2 py-0.5 bg-[#f03060]/10 border border-[#f03060]/20 hover:border-[#f03060]/40 text-[#f03060] font-sans font-bold text-[9.5px] rounded transition"
            >
              Leave
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="flex items-center gap-2 p-1.5 px-2 bg-[#090f1e] border border-[#152236] rounded mb-2 text-[10px]">
        <div className={`w-1.5 h-1.5 rounded-full ${role ? "bg-[#00df6e] animate-pulse" : "bg-[#4a6580]"}`} />
        <span className="font-mono text-[#7a98b4]" title="WebRTC Peer connections status">
          SYNC STATE: {connectionStatus.toUpperCase()}
        </span>
      </div>

      {/* Inline inputs for Joining */}
      {showJoinRow && (
        <div className="flex gap-1.5 p-2 bg-[#0b1322] border border-[#152236] rounded mb-2">
          <input
            type="text"
            placeholder="Paste target Room ID..."
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
            className="flex-grow bg-[#090f1e] border border-[#1e3550] rounded px-2 py-1 text-[10.5px] text-white focus:outline-none focus:border-[#00c8f0]"
          />
          <button onClick={handleJoinRoom} className="px-2.5 py-1 bg-[#00c8f0] text-black font-bold rounded hover:brightness-110 shrink-0">
            Link
          </button>
          <button
            onClick={() => setShowJoinRow(false)}
            className="px-1.5 py-1 bg-[#090f1e] border border-[#152236] hover:text-[#f03060] rounded shrink-0 text-[#4a6580]"
          >
            ✕
          </button>
        </div>
      )}

      {role && (
        <div className="flex flex-col gap-2 mt-2">
          {/* Room credentials credentials board */}
          <div className="flex items-center justify-between p-1 bg-[#0b1322] border border-[#152236] rounded px-2">
            <span className="font-mono text-[9.5px] text-[#4a6580]">ROOM ID</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-bold text-[#00c8f0]">{roomCode.slice(0, 10)}...</span>
              <button onClick={copyRoomCode} className="text-[#4a6580] hover:text-white" title="Copy code">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Connected Peers list flow */}
          <div className="flex items-center flex-wrap gap-1">
            <span className="text-[9px] font-mono text-[#4a6580] uppercase mr-1">PEERS:</span>
            {activePeers.map((peer, pIdx) => (
              <span
                key={pIdx}
                className="px-2 py-0.5 rounded-full bg-[#152236] text-[9.5px] font-mono text-[#b8d0e8] border border-[#1e3550]"
              >
                {peer}
              </span>
            ))}
          </div>

          <div className="h-[1px] bg-[#152236] my-1" />

          {/* Interactive Chat messages wrapper */}
          <div className="bg-[#090f1e] border border-[#152236] rounded p-2 flex flex-col gap-2.5 max-h-36 overflow-y-auto">
            {chatMessages.length === 0 ? (
              <em className="text-[#4a6580] italic text-[10px]">P2P chat room activated. Write text messages below to coordinate.</em>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="text-[10px]">
                  <div className="flex justify-between items-center mb-0.5 text-[#4a6580] font-mono text-[9px]">
                    <span className="font-bold text-[#00c8f0]">{msg.sender}</span>
                    <span>{msg.ts}</span>
                  </div>
                  {msg.image ? (
                    <div className="mt-1 max-w-[200px]">
                      <img src={msg.image} className="rounded border border-[#1e3550] w-full" alt="Shared workspace visual captured frame" />
                    </div>
                  ) : (
                    <span className="text-[#b8d0e8] whitespace-pre-wrap">{msg.text}</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Controls box */}
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Broadcast chat to group..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
              className="flex-grow bg-[#090f1e] border border-[#152236] rounded px-2 py-1 text-[10.5px] text-white focus:outline-none focus:border-[#00c8f0]"
            />
            <button
              onClick={sendChatMessage}
              className="px-2.5 py-1 bg-[#0b1322] border border-[#152236] text-[#b8d0e8] hover:text-[#00c8f0] hover:border-[#00c8f0]/40 rounded font-bold"
            >
              Send
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={shareScreenCapture}
              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[#0b1322] border border-[#152236] hover:border-[#00c8f0]/40 text-[#b8d0e8] hover:text-[#00c8f0] rounded cursor-pointer transition"
            >
              <ScreenShare className="w-3.5 h-3.5" />
              Sync Frame
            </button>
            <button
              onClick={shareAIResult}
              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[#0b1322] border border-[#152236] hover:border-[#9d78f8]/40 text-[#b8d0e8] hover:text-[#9d78f8] rounded cursor-pointer transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              Sync AI Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
