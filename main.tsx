import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { createChart, CrosshairMode } from "lightweight-charts";
import { 
  Wallet, History, AlertCircle, Brain, ArrowRight, TrendingUp, 
  BarChart2, CheckCircle, XCircle, Star, ChevronUp, ChevronDown, Lock 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- UTILIDADES ---
function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

// --- ASSETS Y LÓGICA DE TRADIX ---
const ASSETS = [
  { symbol: "BTC", name: "Bitcoin", basePrice: 65000, volatility: 0.012 },
  { symbol: "ETH", name: "Ethereum", basePrice: 3500, volatility: 0.015 },
  { symbol: "AAPL", name: "Apple", basePrice: 175, volatility: 0.008 }
];

const TIMEFRAMES = [{ label: "1H", seconds: 3600, count: 60 }];

// --- GENERADOR DE VELAS ---
function genCandles(basePrice: number, vol: number, count: number, secs: number) {
  const out = [];
  let p = basePrice;
  const now = Math.floor(Date.now() / 1000);
  for (let i = count - 1; i >= 0; i--) {
    const o = p;
    const c = o + (Math.random() - 0.5) * vol * o;
    out.push({
      time: now - i * secs,
      open: +o.toFixed(2),
      high: +(Math.max(o, c) + Math.random() * 5).toFixed(2),
      low: +(Math.min(o, c) - Math.random() * 5).toFixed(2),
      close: +c.toFixed(2),
    });
    p = c;
  }
  return out;
}

// --- COMPONENTE PRINCIPAL SIMULATOR ---
export default function Simulator() {
  const [balance, setBalance] = useState(10000);
  const [asset, setAsset] = useState(ASSETS[0]);
  const mainRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!mainRef.current) return;
    
    const chart = createChart(mainRef.current, {
      layout: { background: { color: "#000000" }, textColor: "#64748b" },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      width: mainRef.current.clientWidth,
      height: 400,
      crosshair: { mode: CrosshairMode.Normal },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#10b981", downColor: "#e11d48",
      borderVisible: false, wickUpColor: "#10b981", wickDownColor: "#e11d48",
    });

    const data = genCandles(asset.basePrice, asset.volatility, 60, 3600);
    series.setData(data);
    chartRef.current = chart;

    const handleResize = () => chart.applyOptions({ width: mainRef.current?.clientWidth || 600 });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [asset]);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      <nav className="border-b border-gray-800 p-6 flex justify-between items-center bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <Brain size={24} className="text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter italic">TRADIX</span>
        </div>
        <div className="flex items-center gap-4 bg-gray-900/80 px-5 py-2.5 rounded-2xl border border-gray-800">
          <Wallet size={18} className="text-blue-400" />
          <span className="font-mono font-bold text-lg">{formatCurrency(balance)}</span>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-gray-900/40 border border-gray-800 rounded-[2.5rem] p-8 backdrop-blur-sm shadow-2xl">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-black text-white mb-1">{asset.name}</h2>
                <div className="flex items-center gap-2 text-green-400 font-bold bg-green-400/10 px-3 py-1 rounded-lg w-fit">
                  <TrendingUp size={16} /> +2.4%
                </div>
              </div>
              <div className="flex gap-2">
                {ASSETS.map(a => (
                  <button 
                    key={a.symbol}
                    onClick={() => setAsset(a)}
                    className={cn("px-4 py-2 rounded-xl font-bold transition-all", asset.symbol === a.symbol ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700")}
                  >
                    {a.symbol}
                  </button>
                ))}
              </div>
            </div>
            <div ref={mainRef} className="rounded-xl overflow-hidden" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] p-8 shadow-xl">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
              <BarChart2 className="text-blue-500" /> Operar
            </h3>
            <div className="space-y-4">
               <button className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-green-500/20">
                COMPRAR
              </button>
              <button className="w-full bg-red-500 hover:bg-red-400 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-red-500/20">
                VENDER
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Simulator />);
}
