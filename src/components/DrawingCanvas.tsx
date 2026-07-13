import React, { useRef, useState, useEffect } from "react";
import { Camera, Edit2, Ban, Undo, Award, Trash2 } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  type: "pen" | "rect" | "arrow" | "text";
  points?: Point[];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  color: string;
  size: number;
  text?: string;
}

interface DrawingCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCapturing: boolean;
  paused: boolean;
  onStartCapture: () => void;
  onStartSimulation: () => void;
  roiEnabled: boolean;
  roiX: number;
  roiY: number;
  roiW: number;
  roiH: number;
  setRoiCoords: (x: number, y: number, w: number, h: number) => void;
  diffOverlayActive: boolean;
  onToggleDiff: () => void;
  onSaveScreenshot: () => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  canvasRef,
  videoRef,
  isCapturing,
  paused,
  onStartCapture,
  onStartSimulation,
  roiEnabled,
  roiX,
  roiY,
  roiW,
  roiH,
  setRoiCoords,
  diffOverlayActive,
  onToggleDiff,
  onSaveScreenshot,
}) => {
  const annCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Annotation states
  const [annActive, setAnnActive] = useState<boolean>(false);
  const [annTool, setAnnTool] = useState<"pen" | "rect" | "arrow" | "text">("pen");
  const [annColor, setAnnColor] = useState<string>("#00c8f0");
  const [annSize, setAnnSize] = useState<number>(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  const startPos = useRef<Point>({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  // Flash Capture Feedback
  const [flashOn, setFlashOn] = useState<boolean>(false);

  // ROI dragging state
  const [roiDragActive, setRoiDragActive] = useState<boolean>(false);
  const [roiDragStart, setRoiDragStart] = useState<Point>({ x: 0, y: 0 });
  const [roiDragCurrent, setRoiDragCurrent] = useState<Point>({ x: 0, y: 0 });

  const [canvasDOMSize, setCanvasDOMSize] = useState({ width: 640, height: 360 });

  // Sync size of Annotation canvas with the primary video canvas
  useEffect(() => {
    const annCanvas = annCanvasRef.current;
    const baseCanvas = canvasRef.current;
    if (!annCanvas || !baseCanvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setCanvasDOMSize({
          width: entry.contentRect.width || baseCanvas.clientWidth || 640,
          height: entry.contentRect.height || baseCanvas.clientHeight || 360,
        });
      } else {
        setCanvasDOMSize({
          width: baseCanvas.clientWidth || 640,
          height: baseCanvas.clientHeight || 360,
        });
      }
      annCanvas.width = baseCanvas.width || 1280;
      annCanvas.height = baseCanvas.height || 720;
      redrawStrokes();
    });

    resizeObserver.observe(baseCanvas);
    
    // Initial sync
    setCanvasDOMSize({
      width: baseCanvas.clientWidth || 640,
      height: baseCanvas.clientHeight || 360,
    });

    return () => resizeObserver.disconnect();
  }, [strokes]);

  const redrawStrokes = () => {
    const canvas = annCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    strokes.forEach((s) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;

      if (s.type === "pen" && s.points && s.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        s.points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      } else if (s.type === "rect" && s.x1 !== undefined && s.y1 !== undefined && s.x2 !== undefined && s.y2 !== undefined) {
        ctx.strokeRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1);
      } else if (s.type === "arrow" && s.x1 !== undefined && s.y1 !== undefined && s.x2 !== undefined && s.y2 !== undefined) {
        drawArrow(ctx, s.x1, s.y1, s.x2, s.y2, s.color, s.size);
      } else if (s.type === "text" && s.x1 !== undefined && s.y1 !== undefined && s.text) {
        ctx.fillStyle = s.color;
        ctx.font = `bold ${Math.max(12, s.size * 5)}px 'JetBrains Mono', monospace`;
        ctx.fillText(s.text, s.x1, s.y1);
      }
    });
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, size: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.min(18, Math.hypot(x2 - x1, y2 - y1) * 0.3);

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.45), y2 - headLen * Math.sin(angle - 0.45));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.45), y2 - headLen * Math.sin(angle + 0.45));
    ctx.stroke();
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = annCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!annActive) {
      // Standard ROI drag mode when annotation tool disabled
      if (roiEnabled) {
        const coords = getCanvasCoords(e);
        setRoiDragActive(true);
        setRoiDragStart(coords);
        setRoiDragCurrent(coords);
      }
      return;
    }

    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    startPos.current = coords;

    const ctx = annCanvasRef.current?.getContext("2d");
    if (ctx && annCanvasRef.current) {
      snapshotRef.current = ctx.getImageData(0, 0, annCanvasRef.current.width, annCanvasRef.current.height);
    }

    if (annTool === "text") {
      const text = prompt("Annotation Label Text:");
      if (text) {
        const newStroke: Stroke = {
          type: "text",
          x1: coords.x,
          y1: coords.y,
          color: annColor,
          size: annSize,
          text,
        };
        setStrokes((prev) => [...prev, newStroke]);
      }
      setIsDrawing(false);
      return;
    }

    if (annTool === "pen") {
      const newStroke: Stroke = {
        type: "pen",
        points: [coords],
        color: annColor,
        size: annSize,
      };
      setStrokes((prev) => [...prev, newStroke]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (roiDragActive) {
      setRoiDragCurrent(coords);
      return;
    }

    if (!annActive || !isDrawing) return;

    const canvas = annCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    if (annTool === "pen") {
      setStrokes((prev) => {
        if (prev.length === 0) return prev;
        const last = { ...prev[prev.length - 1] };
        if (last.points) {
          last.points = [...last.points, coords];
        }
        return [...prev.slice(0, -1), last];
      });

      ctx.lineTo(coords.x, coords.y);
      ctx.strokeStyle = annColor;
      ctx.lineWidth = annSize;
      ctx.stroke();
    } else {
      // Live shapes preview via restoring cached frame buffer
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }

      ctx.strokeStyle = annColor;
      ctx.lineWidth = annSize;

      if (annTool === "rect") {
        ctx.strokeRect(startPos.current.x, startPos.current.y, coords.x - startPos.current.x, coords.y - startPos.current.y);
      } else if (annTool === "arrow") {
        drawArrow(ctx, startPos.current.x, startPos.current.y, coords.x, coords.y, annColor, annSize);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (roiDragActive) {
      setRoiDragActive(false);
      const coords = getCanvasCoords(e);
      const rx = Math.max(0, Math.min(roiDragStart.x, coords.x));
      const ry = Math.max(0, Math.min(roiDragStart.y, coords.y));
      const rw = Math.max(10, Math.abs(coords.x - roiDragStart.x));
      const rh = Math.max(10, Math.abs(coords.y - roiDragStart.y));
      setRoiCoords(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh));
      return;
    }

    if (!annActive || !isDrawing) return;
    setIsDrawing(false);

    if (annTool !== "pen") {
      const coords = getCanvasCoords(e);
      const newStroke: Stroke = {
        type: annTool,
        x1: startPos.current.x,
        y1: startPos.current.y,
        x2: coords.x,
        y2: coords.y,
        color: annColor,
        size: annSize,
      };
      setStrokes((prev) => [...prev, newStroke]);
    }
    snapshotRef.current = null;
  };

  const undoLast = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const clearAll = () => {
    setStrokes([]);
  };

  const handleSaveAnnotatedFrame = () => {
    setFlashOn(true);
    setTimeout(() => setFlashOn(false), 150);

    const baseCanvas = canvasRef.current;
    const annotationCanvas = annCanvasRef.current;
    if (!baseCanvas || !annotationCanvas) return;

    // Create an offscreen composited frame
    const finalComp = document.createElement("canvas");
    finalComp.width = baseCanvas.width;
    finalComp.height = baseCanvas.height;
    const ctx = finalComp.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(baseCanvas, 0, 0);
    ctx.drawImage(annotationCanvas, 0, 0);

    const link = document.createElement("a");
    link.href = finalComp.toDataURL("image/png");
    link.download = `screensight_annotated_${Date.now()}.png`;
    link.click();
  };

  const scaleX = canvasRef.current ? canvasDOMSize.width / canvasRef.current.width : 1;
  const scaleY = canvasRef.current ? canvasDOMSize.height / canvasRef.current.height : 1;

  return (
    <div ref={wrapperRef} className="relative bg-black select-none w-full h-full overflow-hidden flex items-center justify-center flex-grow">
      
      {/* Aspect-Locked Compositing Outer Shell centered exactly to canvas scale */}
      <div 
        className="relative flex items-center justify-center"
        style={{
          width: `${canvasDOMSize.width}px`,
          height: `${canvasDOMSize.height}px`,
        }}
      >
        {/* Primary Video Render targets */}
        <canvas ref={canvasRef} className="w-full h-full object-contain" />

        {/* Screen Frame Annotation Layer matches base DOM canvas dimensions pixel-for-pixel */}
        <canvas
          ref={annCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsDrawing(false)}
          className={`absolute inset-0 w-full h-full object-contain overflow-hidden z-20 ${
            annActive ? "cursor-crosshair pointer-events-auto" : roiEnabled ? "cursor-nwse-resize pointer-events-auto" : "pointer-events-none"
          }`}
        />

        <video ref={videoRef} className="hidden" muted playsInline autoPlay />

        {/* Visual Sandbox overlay indicators */}
        {paused && isCapturing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded-full text-xs font-mono font-bold tracking-wider text-[#ff8c00] animate-pulse uppercase z-30">
            ⏸ PAUSED
          </div>
        )}

        {/* ROI Drag selector bounds */}
        {roiEnabled && isCapturing && !annActive && (
          <div
            className="absolute border-2 border-[#00c8f0] bg-black/45 flex items-start justify-start p-1 pointer-events-none z-30 outline-none"
            style={{
              left: `${roiX * scaleX}px`,
              top: `${roiY * scaleY}px`,
              width: `${roiW * scaleX}px`,
              height: `${roiH * scaleY}px`,
              boxShadow: "0 0 0 9999px rgba(3, 7, 14, 0.45) inset, 0 0 8px #00c8f033",
            }}
          >
            <div className="text-[9px] font-mono text-[#00c8f0] leading-none bg-[#03070e] px-1 py-0.5 rounded border border-[#152236]">
              ROI TARGET: {roiW}×{roiH}px
            </div>
          </div>
        )}

        {/* Dynamic Drag Preview Overlay for live draw */}
        {roiDragActive && (
          <div
            className="absolute border border-dashed border-[#00c8f0] bg-cyan-500/10 pointer-events-none z-30"
            style={{
              left: `${Math.min(roiDragStart.x, roiDragCurrent.x) * scaleX}px`,
              top: `${Math.min(roiDragStart.y, roiDragCurrent.y) * scaleY}px`,
              width: `${Math.abs(roiDragCurrent.x - roiDragStart.x) * scaleX}px`,
              height: `${Math.abs(roiDragCurrent.y - roiDragStart.y) * scaleY}px`,
            }}
          />
        )}

        {/* Shutter flash effect */}
        <div
          className={`absolute inset-0 bg-[#00c8f0]/25 transition-opacity duration-300 pointer-events-none z-45 ${
            flashOn ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {/* Frame diff overlay toggle banner */}
      {isCapturing && (
        <button
          onClick={onToggleDiff}
          className={`absolute bottom-3 right-4 px-3 py-1 text-[10px] font-semibold border rounded-full backdrop-blur z-20 transition-all ${
            diffOverlayActive
              ? "bg-[#00c8f0]/15 border-[#00c8f0]/40 text-[#00c8f0]"
              : "bg-black/60 border-[#152236] text-[#4a6580] hover:text-[#b8d0e8]"
          }`}
        >
          Heatmap Diff: {diffOverlayActive ? "ON" : "OFF"}
        </button>
      )}

      {/* Standby Message */}
      {!isCapturing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#03070e]/95 gap-3 pointer-events-auto z-30">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-[#00c8f0] to-[#9d78f8] p-[1.5px] items-center justify-center flex shadow-lg shadow-[#00c8f0]/10">
            <div className="w-full h-full bg-[#060c17] rounded-[7.5px] flex items-center justify-center">
              <Camera className="w-5 h-5 text-[#00c8f0] animate-pulse" />
            </div>
          </div>
          <div className="text-base font-bold font-syne text-transparent bg-clip-text bg-gradient-to-r from-white via-[#b8d0e8] to-[#00c8f0]">
            ScreenSight Pro v4
          </div>
          <p className="text-[11px] text-[#4a6580] text-center max-w-sm leading-relaxed px-4">
            Isolate specific chart metrics, indicators, or system tables to evaluate and alert on visual fluctuations instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <button
              onClick={onStartCapture}
              className="px-4 py-2 bg-[#00c8f0] hover:brightness-110 text-black font-extrabold text-[11px] rounded transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#00c8f0]/10"
            >
              Start Stream Capture
            </button>
            <button
              onClick={onStartSimulation}
              className="px-4 py-2 bg-[#9d78f8]/10 border border-[#9d78f8]/30 hover:bg-[#9d78f8]/20 text-[#9d78f8] font-extrabold text-[11px] rounded transition cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
            >
              Start Sandbox Simulation
            </button>
          </div>
        </div>
      )}

      {/* Annotations Draw Panel controls floating at bottom */}
      {annActive && isCapturing && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#060c17]/95 border border-[#1e3550] rounded-full flex items-center gap-3 backdrop-blur shadow-xl shadow-black/85 pointer-events-auto z-40 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex gap-0.5">
            {(["pen", "rect", "arrow", "text"] as const).map((tool) => (
              <button
                key={tool}
                onClick={() => setAnnTool(tool)}
                className={`w-7 h-7 rounded-full text-xs font-semibold uppercase flex items-center justify-center border transition-all ${
                  annTool === tool
                    ? "bg-[#00c8f0]/15 border-[#00c8f0]/40 text-[#00c8f0]"
                    : "border-transparent text-[#4a6580] hover:text-[#b8d0e8]"
                }`}
                title={`${tool} annotation tool`}
              >
                {tool === "pen" && <Edit2 className="w-3.5 h-3.5" />}
                {tool === "rect" && <div className="w-3 h-2 border border-current rounded-sm" />}
                {tool === "arrow" && <Award className="w-3.5 h-3.5" />}
                {tool === "text" && <span className="font-mono text-xs font-black">T</span>}
              </button>
            ))}
          </div>

          <div className="h-4 w-[1px] bg-[#152236]" />

          {/* Sizing scale */}
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono text-[#4a6580]">Brush</span>
            <input
              type="range"
              min={1}
              max={15}
              value={annSize}
              onChange={(e) => setAnnSize(parseInt(e.target.value))}
              className="accent-[#00c8f0] w-12"
            />
          </div>

          <div className="h-4 w-[1px] bg-[#152236]" />

          {/* Solid color swatches */}
          <div className="flex gap-1">
            {["#00c8f0", "#f03060", "#00df6e", "#f5c842", "#ffffff"].map((color) => (
              <button
                key={color}
                onClick={() => setAnnColor(color)}
                style={{ backgroundColor: color }}
                className={`w-3.5 h-3.5 rounded-full border transition-all ${
                  annColor === color ? "border-white scale-110 shadow-lg shadow-white/20" : "border-black/50 hover:scale-105"
                }`}
              />
            ))}
          </div>

          <div className="h-4 w-[1px] bg-[#152236]" />

          <button onClick={undoLast} className="text-[#4a6580] hover:text-white transition" title="Undo visual brush stroke">
            <Undo className="w-4 h-4" />
          </button>
          <button onClick={clearAll} className="text-[#4a6580] hover:text-[#f03060] transition" title="Clear annotation memory">
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleSaveAnnotatedFrame}
            className="px-2.5 py-1 bg-[#00c8f0] text-black text-[10px] font-bold rounded-full hover:brightness-110 active:scale-95 transition"
            title="Download composited PNG screenshot"
          >
            Save Comp
          </button>
        </div>
      )}

      {/* Toggle floating annotation mode trigger */}
      {isCapturing && (
        <button
          onClick={() => setAnnActive((prev) => !prev)}
          className={`absolute bottom-3 left-4 px-3 py-1 text-[10px] font-semibold border rounded-full backdrop-blur z-20 transition-all flex items-center gap-1.5 hover:scale-105 ${
            annActive
              ? "bg-[#00c8f0]/15 border-[#00c8f0]/40 text-[#00c8f0]"
              : "bg-black/60 border-[#152236] text-[#4a6580] hover:text-[#b8d0e8]"
          }`}
          title="Toggle vector marking layer"
        >
          <Edit2 className="w-3 h-3" />
          {annActive ? "Close Drawing" : "Draw Mode"}
        </button>
      )}
    </div>
  );
};
