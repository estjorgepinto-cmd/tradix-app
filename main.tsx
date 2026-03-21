import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChart, ColorType } from 'lightweight-charts';
import { TrendingUp, TrendingDown, Wallet, BarChart3, Settings, User } from 'lucide-react';

const TradixApp = () => {
  const chartContainerRef = useRef(null);
  const [balance, setBalance] = useState(10000);
  const [symbol, setSymbol] = useState('BTC/USD');

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#000000' }, textColor: '#d1d5db' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444', borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    });

    // Datos simulados
    const data = [];
    let time = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 100; i++) {
      data.push({
        time: time.toISOString().split('T')[0],
        open: 50000 + Math.random() * 1000,
        high: 52000 + Math.random() * 1000,
        low: 48000 + Math.random() * 1000,
        close: 51000 + Math.random() * 1000,
      });
      time.setDate(time.getDate() + 1);
    }
    candleSeries.setData(data);

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [symbol]);

  return (
    <div class="min-h-screen bg-black text-white font-sans">
      <nav class="border-b border-gray-800 p-4 flex justify-between items-center bg-gray-900/50">
        <div class="flex items-center gap-2">
          <div class="bg-blue-600 p-1.5 rounded-lg"><BarChart3 size={24}/></div>
          <span class="text-xl font-bold tracking-tighter">TRADIX</span>
        </div>
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full">
            <Wallet size={18} class="text-blue-400"/>
            <span class="font-mono text-green-400">${balance.toLocaleString()}</span>
          </div>
          <User size={20} class="text-gray-400 cursor-pointer hover:text-white"/>
        </div>
      </nav>

      <main class="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div class="lg:col-span-3 space-y-6">
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div class="flex gap-4 mb-4">
              {['BTC/USD', 'ETH/USD', 'AAPL', 'EUR/USD'].map((s) => (
                <button 
                  key={s}
                  onClick={() => setSymbol(s)}
                  class={`px-4 py-2 rounded-lg text-sm font-medium transition ${symbol === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div ref={chartContainerRef} class="w-full"></div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 class="text-lg font-semibold mb-4">Operar</h2>
            <div class="space-y-4">
              <button class="w-full bg-green-600 hover:bg-green-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                <TrendingUp size={20}/> COMPRAR
              </button>
              <button class="w-full bg-red-600 hover:bg-red-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                <TrendingDown size={20}/> VENDER
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<TradixApp />);
