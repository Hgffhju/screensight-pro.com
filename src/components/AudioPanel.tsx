import React, { useRef, useState, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, Trash2 } from "lucide-react";
import { LogEntry } from "../types";

interface AudioPanelProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  feedSpeechToAI: boolean;
  setFeedSpeechToAI: (val: boolean) => void;
  transcriptText: string;
  setTranscriptText: React.Dispatch<React.SetStateAction<string>>;
  onAddLog: (msg: string, type: LogEntry["type"]) => void;
}

export const AudioPanel: React.FC<AudioPanelProps> = ({
  soundEnabled,
  onToggleSound,
  feedSpeechToAI,
  setFeedSpeechToAI,
  transcriptText,
  setTranscriptText,
  onAddLog,
}) => {
  const [audioCapturing, setAudioCapturing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const speechRef = useRef<any>(null); // SpeechRecognition instance
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      stopAudioCapture();
    };
  }, []);

  const toggleAudio = async () => {
    if (audioCapturing) {
      stopAudioCapture();
    } else {
      await startAudioCapture();
    }
  };

  const startAudioCapture = async () => {
    setErrorMessage("");
    try {
      // Capture system audio or fallback to microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(async () => {
        // Fallback display capture with audio
        return await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true });
      });

      streamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) throw new Error("No available voice tracks discovered.");

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setAudioCapturing(true);
      onAddLog("Voice capturing stream connected.", "success");

      drawWaveform();
      startSpeechRecognition();

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Voice access rejected.");
      onAddLog(`Voice Stream Capture Error: ${err.message}`, "error");
    }
  };

  const stopAudioCapture = () => {
    setAudioCapturing(false);

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch (_) {}
      speechRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (_) {}
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (_) {}
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const canvas = waveformCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const drawWaveform = () => {
    const canvas = waveformCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current) return;
      animFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "#090f1e";
      ctx.fillRect(0, 0, w, h);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#00c8f0";
      ctx.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(w, h / 2);
      ctx.stroke();
    };

    draw();
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onAddLog("Local browser Web Speech API is not supported in this frame.", "info");
      return;
    }

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (event: any) => {
      let finalSegment = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
         if (event.results[i].isFinal) {
           finalSegment += event.results[i][0].transcript + " ";
         }
      }

      if (finalSegment) {
        setTranscriptText((prev) => (prev ? prev + " " : "") + finalSegment.trim());
      }
    };

    recog.onerror = (e: any) => {
      if (e.error === "no-speech") return;
      console.warn("Speech recognition warning:", e.error);
    };

    recog.onend = () => {
      // Keep re-invoking speech recognition as long as capture toggle is active
      if (streamRef.current && recog) {
        try {
          recog.start();
        } catch (_) {}
      }
    };

    speechRef.current = recog;
    recog.start();
  };

  const clearTranscript = () => {
    setTranscriptText("");
  };

  const wordCount = transcriptText ? transcriptText.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="border-b border-[#152236] p-3 text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-semibold tracking-wider text-[#4a6580] uppercase flex items-center gap-1.5 font-syne">
          <Mic className="w-3.5 h-3.5 text-[#00c8f0]" />
          Visual Companion Sound & Transcript
        </span>
        <div className="flex gap-1">
          <button
            onClick={toggleAudio}
            className={`px-2.5 py-1 text-[9.5px] font-bold rounded flex items-center gap-1 transition ${
              audioCapturing
                ? "bg-[#f03060]/10 text-[#f03060] border border-[#f03060]/40"
                : "bg-[#00c8f0]/10 text-[#00c8f0] border border-[#00c8f0]/20 hover:border-[#00c8f0]/40"
            }`}
          >
            {audioCapturing ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            {audioCapturing ? "Stop Capture" : "Capture Mic"}
          </button>
          <button
            onClick={clearTranscript}
            className="p-1 px-1.5 bg-[#0b1322] border border-[#152236] text-[#4a6580] hover:text-[#f03060] rounded transition"
            title="Wipe transcript buffer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        {/* Connection status tracker */}
        <div
          className={`flex items-center gap-2 p-2 rounded border transition-all ${
            audioCapturing
              ? "bg-[#00df6e]/5 border-[#00df6e]/20 text-[#00df6e]"
              : errorMessage
              ? "bg-[#f03060]/5 border-[#f03060]/20 text-[#f03060]"
              : "bg-[#090f1e] border-[#152236] text-[#4a6580]"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              audioCapturing ? "bg-[#00df6e] animate-ping" : errorMessage ? "bg-[#f03060]" : "bg-[#1e3550]"
            }`}
          />
          <span className="text-[10px] font-mono leading-none tracking-wide">
            {audioCapturing ? "TRANSCRIPT SERVICES: ACTIVE" : errorMessage ? `ERROR: ${errorMessage}` : "TRANSCRIPT SERVICES: INACTIVE"}
          </span>
        </div>

        {/* Waves spectrum ref */}
        <canvas ref={waveformCanvasRef} className="w-full h-8 bg-[#090f1e] border border-[#152236] rounded block" />

        {/* Dynamic Transcript Container */}
        <div className="bg-[#090f1e] border border-[#152236] p-2.5 rounded text-[11px] leading-relaxed max-h-20 min-h-12 overflow-y-auto font-mono text-[#7a98b4]">
          {transcriptText ? (
            <span className="text-white animate-fade-in">{transcriptText}</span>
          ) : (
            <em className="text-[#4a6580] italic">Words translated from microphone audio stream appear here...</em>
          )}
        </div>

        {/* Speech config triggers */}
        <div className="flex justify-between items-center mt-1">
          <span className="text-[9.5px] font-mono text-[#4a6580]">{wordCount} words captured</span>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSound}
              className={`flex items-center gap-1.5 transition text-[10px] uppercase font-bold leading-none ${
                soundEnabled ? "text-[#00df6e]" : "text-[#4a6580]"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 animate-bounce" /> : <VolumeX className="w-3.5 h-3.5" />}
              Alert Chimes {soundEnabled ? "On" : "Off"}
            </button>

            <label className="flex items-center gap-2 cursor-pointer relative text-[10px] select-none text-[#7a98b4]">
              <input
                type="checkbox"
                checked={feedSpeechToAI}
                onChange={(e) => setFeedSpeechToAI(e.target.checked)}
                className="rounded border-[#152236] text-[#00c8f0] bg-black focus:ring-0 w-3 h-3 cursor-pointer"
              />
              Inject to Gemini context
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
