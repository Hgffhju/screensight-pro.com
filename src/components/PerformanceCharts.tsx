import React, { useEffect, useRef } from "react";

interface SparklineProps {
  data: number[];
  color: string;
  label: string;
  value: string | number;
  valueColor: string;
}

export const Sparkline: React.FC<SparklineProps> = ({ data, color, label, value, valueColor }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI retina screens smoothly
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 32 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 32;

    ctx.clearRect(0, 0, w, h);

    if (data.length === 0) return;

    const maxVal = Math.max(...data, 0.001);
    const minVal = Math.min(...data, 0);

    const range = maxVal - minVal;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    data.forEach((val, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w;
      const y = h - ((val - minVal) / (range || 1)) * h * 0.8 - 3;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Create a beautiful, subtle gradient filled region under the sparkline
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + "26"); // 15% opacity
    grad.addColorStop(1, color + "03"); // 1% opacity
    ctx.fillStyle = grad;
    ctx.fill();

  }, [data, color]);

  return (
    <div className="bg-[#060c17] p-3 flex flex-col justify-between relative overflow-hidden border-r border-[#152236] last:border-r-0">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00c8f0]/5 to-transparent"></div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[8.5px] font-semibold text-[#4a6580] tracking-widest uppercase font-sans">
          {label}
        </span>
        <span className="text-[13.5px] font-mono font-bold font-numeric-tabular leading-none" style={{ color: valueColor }}>
          {value}
        </span>
      </div>
      <canvas ref={canvasRef} className="w-full h-8 block" />
    </div>
  );
};

interface PerformanceChartsProps {
  fpsHistory: number[];
  deltaHistory: number[];
  ocrConfHistory: number[];
  priceHistory: number[];
  currentFps: number;
  currentDelta: number;
  currentConf: number;
  currentTrend: string;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  fpsHistory,
  deltaHistory,
  ocrConfHistory,
  priceHistory,
  currentFps,
  currentDelta,
  currentConf,
  currentTrend,
}) => {
  const latestPrice = priceHistory[priceHistory.length - 1] || null;

  return (
    <div className="grid grid-cols-4 gap-[1px] bg-[#152236] border-t border-[#152236] h-[104px]">
      <Sparkline
        label="Frame Rate"
        data={fpsHistory}
        color="#00df6e"
        value={`${currentFps.toFixed(1)} FPS`}
        valueColor="#00df6e"
      />
      <Sparkline
        label="Change Δ"
        data={deltaHistory}
        color="#00c8f0"
        value={currentDelta.toFixed(1)}
        valueColor="#00c8f0"
      />
      <Sparkline
        label="OCR Conf"
        data={ocrConfHistory}
        color="#9d78f8"
        value={currentConf > 0 ? `${currentConf.toFixed(0)}%` : "—"}
        valueColor="#9d78f8"
      />
      <Sparkline
        label="Price Trend"
        data={priceHistory}
        color="#f5c842"
        value={currentTrend || (latestPrice ? latestPrice.toLocaleString() : "—")}
        valueColor="#f5c842"
      />
    </div>
  );
};
