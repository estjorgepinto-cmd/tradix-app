import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createChart, CrosshairMode } from "lightweight-charts";
import { Wallet, Brain, TrendingUp, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- UTILIDADES (Reemplazan a los archivos que faltan) ---
function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

const ASSETS = [
  { symbol: "BTC", name: "Bitcoin", basePrice: 65000, volatility: 0.012 },
  { symbol: "ETH", name: "Ethereum", basePrice: 3500, volatility: 0.015 },
  { symbol: "AAPL", name: "Apple", basePrice: 175, volatility: 0.008 }
];

// --- GENERADOR DE VELAS (Tu lógica original) ---
function genCandles(basePrice: number, vol: number, count: number) {
  const out = [];
  let p = basePrice;
  const now = Math.floor(Date.now() / 1000);
  for (let i = count - 1; i >= 0; i--) {
    const o = p;
    const c = o + (Math.random() - 0.5) * vol * o;
    out.push({
      time: now - i * 3600,
      open: +o.toFixed(2),
      high: +(Math.max(o, c) + Math.random() * 5).toFixed(2),
      low: +(Math.min(o, c) - Math.random() * 5).toFixed(2),
      close: +c.toFixed(2),
    });
    p = c;
  }
  return out;
}

export default function Simulator() {
  const [balance, setBalance] = useState(10000);
  const [asset, setAsset] = useState(ASSETS[0]);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainRef.current) return;
    const chart = createChart(mainRef.current, {
      layout: { background: { color: "#000" }, textColor: "#64748b" },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      width: mainRef.current.clientWidth,
      height: 400,
    });
    const series = chart.addCandlestickSeries({ upColor: "#10b981", downColor: "#e11d48" });
    series.setData(genCandles(asset.basePrice, asset.volatility, 60));
    return () => chart.remove();
  }, [asset]);

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <nav className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <Brain className="text-blue-500" size={32} />
          <span className="text-2xl font-black italic">TRADIX PRO</span>
        </div>
        <div className="bg-gray-900 px-6 py-2 rounded-2xl border border-gray-800 flex items-center gap-3">
          <Wallet className="text-blue-400" size={20} />
          <span className="text-xl font-mono">{formatCurrency(balance)}</span>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-gray-900/40 p-8 rounded-[2rem] border border-gray-800">
          <div className="flex justify-between mb-6">
            <h2 className="text-3xl font-bold">{asset.name}</h2>
            <div className="flex gap-2">
              {ASSETS.map(a => (
                <button key={a.symbol} onClick={() => setAsset(a)} className={cn("px-4 py-2 rounded-lg font-bold", asset.symbol === a.symbol ? "bg-blue-600" : "bg-gray-800")}>
                  {a.symbol}
                </button>
              ))}
            </div>
          </div>
          <div ref={mainRef} />
        </div>
        
        <div className="bg-gray-900 p-8 rounded-[2rem] border border-gray-800 space-y-4">
          <h3 className="text-xl font-bold mb-4">Panel de Control</h3>
          <button onClick={() => setBalance(b => b + 100)} className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-4 rounded-xl shadow-lg shadow-green-500/20 transition-all active:scale-95">COMPRAR</button>
          <button onClick={() => setBalance(b => b - 100)} className="w-full bg-red-500 hover:bg-red-400 text-white font-black py-4 rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95">VENDER</button>
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) { createRoot(container).render(<Simulator />); }
