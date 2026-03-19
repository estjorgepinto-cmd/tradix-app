import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  createChart,
  CrosshairMode,
} from "lightweight-charts";
import {
  Wallet,
  TrendingUp,
  Brain,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

// --- Configuración de Activos ---
const ASSETS = [
  { symbol: "BTC", name: "Bitcoin", basePrice: 65000, volatility: 0.012 },
  { symbol: "ETH", name: "Ethereum", basePrice: 3500, volatility: 0.015 },
  { symbol: "AAPL", name: "Apple", basePrice: 175, volatility: 0.008 },
  { symbol: "EUR/USD", name: "Euro/Dólar", basePrice: 1.085, volatility: 0.003 },
];

const TIMEFRAME = { label: "1H", seconds: 3600, count: 80 };

// --- Generador de Velas (Simulación) ---
function genCandles(basePrice: number, vol: number, count: number, secs: number) {
  const out = [];
  let p = basePrice * (0.94 + Math.random() * 0.12);
  const now = Math.floor(Date.now() / 1000);
  for (let i = count - 1; i >= 0; i--) {
    const o = p;
    const drift = (Math.random() - 0.48) * vol * o;
    const c = Math.max(o + drift, o * 0.001);
    const wick = vol * 0.35 * o;
    out.push({
      time: now - i * secs,
      open: +o.toFixed(4),
      high: +(Math.max(o, c) + Math.random() * wick).toFixed(4),
      low: +(Math.min(o, c) - Math.random() * wick).toFixed(4),
      close: +c.toFixed(4),
    });
    p = c;
  }
  return out;
}

const CHART_THEME = {
  layout: { background: { color: "#0f172a" }, textColor: "#64748b", fontSize: 12 },
  grid: { vertLines: { color: "rgba(30,41,59,0.5)" }, horzLines: { color: "rgba(30,41,59,0.5)" } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: "#1e293b" },
  timeScale: { borderColor: "#1e293b", timeVisible: true },
};

function Simulator() {
  const [asset, setAsset] = useState(ASSETS[0]);
  const mainRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!mainRef.current) return;

    const chart = createChart(mainRef.current, {
      ...CHART_THEME,
      width: mainRef.current.clientWidth,
      height: 400,
    });

    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#e11d48",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#e11d48",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const initialData = genCandles(asset.basePrice, asset.volatility, TIMEFRAME.count, TIMEFRAME.seconds);
    series.setData(initialData as any);

    const handleResize = () => {
      chart.applyOptions({ width: mainRef.current?.clientWidth });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [asset]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg"><TrendingUp size={24} /></div>
            <div>
              <h1 className="text-xl font-bold">TRADIX SIMULATOR</h1>
              <p className="text-xs text-slate-400">Entrenamiento en tiempo real</p>
            </div>
          </div>
          <div className="flex gap-2">
            {ASSETS.map((a) => (
              <button
                key={a.symbol}
                onClick={() => setAsset(a)}
                className={`px-3 py-1 rounded-md text-sm transition ${
                  asset.symbol === a.symbol ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {a.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Gráfico */}
        <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
          <div ref={mainRef} className="w-full" />
        </div>

        {/* Panel Inferior */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-3">
            <Brain className="text-blue-500" size={32} />
            <h3 className="font-semibold">Modo Práctica</h3>
            <p className="text-sm text-slate-400 text-center">Analiza y decide tu entrada.</p>
          </div>
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col gap-3">
            <button className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold flex items-center justify-center gap-2">
              <ChevronUp /> COMPRAR
            </button>
            <button className="w-full py-3 bg-rose-600 hover:bg-rose-500 rounded-lg font-bold flex items-center justify-center gap-2">
              <ChevronDown /> VENDER
            </button>
          </div>
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="text-amber-500" size={20} />
              <span className="text-sm font-medium">Balance Virtual</span>
            </div>
            <div className="text-2xl font-mono font-bold text-emerald-400">$10,000.00</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Renderizado de la App ---
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Simulator />);
}
