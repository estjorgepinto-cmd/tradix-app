import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// --- COMPONENTE DEL GRÁFICO ---
const ChartComponent = ({ data }: { data: any[] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#000000' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    });

    candlestickSeries.setData(data);
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-[400px]" />;
};

// --- APP PRINCIPAL ---
const App = () => {
  const [balance] = useState(10000.00);
  
  const mockData = [
    { time: '2024-01-01', open: 42000, high: 43000, low: 41500, close: 42500 },
    { time: '2024-01-02', open: 42500, high: 44000, low: 42000, close: 43800 },
    { time: '2024-01-03', open: 43800, high: 44500, low: 43500, close: 44200 },
    { time: '2024-01-04', open: 44200, high: 44800, low: 43000, close: 43500 },
    { time: '2024-01-05', open: 43500, high: 45000, low: 43200, close: 44800 },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header */}
      <nav className="border-b border-gray-800 p-4 flex justify-between items-center bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <BarChart3 size={24} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tighter text-white">TRADIX</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-full border border-gray-800">
            <Wallet size={18} className="text-blue-400" />
            <span className="font-mono text-blue-100">${balance.toLocaleString()}</span>
          </div>
        </div>
      </nav>

      <main className="p-4 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Panel Central - Gráfico */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold italic text-white">BTC / USDT</h2>
                <p className="text-green-400 flex items-center gap-1 text-sm font-medium">
                  <ArrowUpRight size={16} /> +2.45% Hoy
                </p>
              </div>
              <div className="flex gap-2">
                {['1H', '4H', '1D', '1W'].map((t) => (
                  <button key={t} className="px-3 py-1 text-xs rounded-md bg-gray-800 hover:bg-gray-700 transition-colors">{t}</button>
                ))}
              </div>
            </div>
            <ChartComponent data={mockData} />
          </div>
        </div>

        {/* Panel Lateral - Operaciones */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-full shadow-xl">
            <h3 className="text-lg font-bold mb-6 border-b border-gray-800 pb-2">Operar</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-2 uppercase tracking-wider">Cantidad (USD)</label>
                <input type="number" placeholder="100.00" className="w-full bg-black border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 transition-all" />
              </div>
              <button className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95">
                <TrendingUp size={20} /> COMPRAR
              </button>
              <button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95">
                <TrendingDown size={20} /> VENDER
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
