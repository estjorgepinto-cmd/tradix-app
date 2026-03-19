import { useState, useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from "lightweight-charts";
import {
  useExecuteTrade,
  useGetPortfolio,
  useGetTradeHistory,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Wallet,
  History,
  AlertCircle,
  Brain,
  ArrowRight,
  TrendingUp,
  BarChart2,
  CheckCircle,
  XCircle,
  Star,
  ChevronUp,
  ChevronDown,
  Lock,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Assets ───────────────────────────────────────────────────────────────────
const ASSETS = [
  { symbol: "BTC", name: "Bitcoin", basePrice: 65000, volatility: 0.012 },
  { symbol: "ETH", name: "Ethereum", basePrice: 3500, volatility: 0.015 },
  { symbol: "AAPL", name: "Apple", basePrice: 175, volatility: 0.008 },
  {
    symbol: "EUR/USD",
    name: "Euro/Dólar",
    basePrice: 1.085,
    volatility: 0.003,
  },
];
const TIMEFRAMES = [
  { label: "15m", seconds: 900, count: 80 },
  { label: "1H", seconds: 3600, count: 60 },
  { label: "4H", seconds: 14400, count: 50 },
  { label: "1D", seconds: 86400, count: 60 },
];

// ─── Candle generation ────────────────────────────────────────────────────────
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function genCandles(
  basePrice: number,
  vol: number,
  count: number,
  secs: number,
): Candle[] {
  const out: Candle[] = [];
  let p = basePrice * (0.94 + Math.random() * 0.12);
  const now = Math.floor(Date.now() / 1000);
  for (let i = count - 1; i >= 0; i--) {
    const o = p,
      drift = (Math.random() - 0.48) * vol * o;
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

function genVolBars(candles: Candle[], base: number) {
  return candles.map((c) => ({
    time: c.time,
    value: base * (0.4 + Math.random()),
    color: c.close >= c.open ? "rgba(16,185,129,0.5)" : "rgba(225,29,72,0.5)",
  }));
}

function computeMA(candles: Candle[], period: number) {
  return candles
    .map((c, i) => {
      if (i < period - 1) return null;
      const avg =
        candles.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) /
        period;
      return { time: c.time, value: +avg.toFixed(4) };
    })
    .filter(Boolean) as { time: number; value: number }[];
}

function computeRSI(candles: Candle[], period = 14) {
  if (candles.length < period + 1) return [];
  const result: { time: number; value: number }[] = [];
  let ag = 0,
    al = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) ag += d;
    else al -= d;
  }
  ag /= period;
  al /= period;
  result.push({
    time: candles[period].time,
    value: +(al === 0 ? 100 : 100 - 100 / (1 + ag / al)).toFixed(1),
  });
  for (let i = period + 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    result.push({
      time: candles[i].time,
      value: +(al === 0 ? 100 : 100 - 100 / (1 + ag / al)).toFixed(1),
    });
  }
  return result;
}

function computeBB(candles: Candle[], period = 20, m = 2) {
  return candles
    .map((c, i) => {
      if (i < period - 1) return null;
      const sl = candles.slice(i - period + 1, i + 1),
        avg = sl.reduce((s, x) => s + x.close, 0) / period;
      const std = Math.sqrt(
        sl.reduce((s, x) => s + (x.close - avg) ** 2, 0) / period,
      );
      return {
        time: c.time,
        upper: +(avg + m * std).toFixed(4),
        mid: +avg.toFixed(4),
        lower: +(avg - m * std).toFixed(4),
      };
    })
    .filter(Boolean) as {
    time: number;
    upper: number;
    mid: number;
    lower: number;
  }[];
}

// ─── Chart theme ──────────────────────────────────────────────────────────────
const CHART_THEME = {
  layout: {
    background: { color: "transparent" },
    textColor: "#64748b",
    fontSize: 10,
  },
  grid: {
    vertLines: { color: "rgba(30,41,59,0.8)" },
    horzLines: { color: "rgba(30,41,59,0.8)" },
  },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: {
    borderColor: "#1e293b",
    scaleMargins: { top: 0.08, bottom: 0.08 },
  },
  timeScale: {
    borderColor: "#1e293b",
    timeVisible: true,
    secondsVisible: false,
  },
};

// ─── Practice scenarios ───────────────────────────────────────────────────────
type AnswerType = "buy_sell" | "choice";

interface Scenario {
  id: string;
  levelMin: number;
  levelMax: number;
  tag: string;
  title: string;
  setup: string;
  question: string;
  answerType: AnswerType;
  options?: string[];
  correct: "buy" | "sell" | number;
  explanation: string;
  tip: string;
  buildCandles: (base: number) => Candle[];
  showRSI?: boolean;
  showBB?: boolean;
  showMA?: boolean;
}

function bull(base: number, n = 30): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  let p = base * 0.93;
  const out: Candle[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const o = p,
      c = o * (1 + Math.random() * 0.019 + 0.003),
      h = c * 1.004,
      l = o * 0.997;
    out.push({
      time: now - i * 3600,
      open: +o.toFixed(4),
      high: +h.toFixed(4),
      low: +l.toFixed(4),
      close: +c.toFixed(4),
    });
    p = c;
  }
  return out;
}
function bear(base: number, n = 30): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  let p = base * 1.07;
  const out: Candle[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const o = p,
      c = o * (1 - Math.random() * 0.019 - 0.003),
      h = o * 1.004,
      l = c * 0.997;
    out.push({
      time: now - i * 3600,
      open: +o.toFixed(4),
      high: +h.toFixed(4),
      low: +l.toFixed(4),
      close: +c.toFixed(4),
    });
    p = c;
  }
  return out;
}
function sideways(base: number, n = 30): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  let p = base;
  const out: Candle[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const o = p,
      c = o + (Math.random() - 0.5) * 0.006 * o,
      h = Math.max(o, c) * 1.003,
      l = Math.min(o, c) * 0.997;
    out.push({
      time: now - i * 3600,
      open: +o.toFixed(4),
      high: +h.toFixed(4),
      low: +l.toFixed(4),
      close: +c.toFixed(4),
    });
    p = base + (Math.random() - 0.5) * 0.015 * base;
  }
  return out;
}
function hammer(base: number): Candle[] {
  const out = bear(base * 1.04, 18);
  const now = Math.floor(Date.now() / 1000);
  const p = out[out.length - 1].close;
  out.push({
    time: now - 2 * 3600,
    open: +p.toFixed(4),
    high: +(p * 1.003).toFixed(4),
    low: +(p * 0.982).toFixed(4),
    close: +(p * 1.004).toFixed(4),
  });
  out.push({
    time: now - 3600,
    open: +(p * 1.004).toFixed(4),
    high: +(p * 1.013).toFixed(4),
    low: +(p * 1.001).toFixed(4),
    close: +(p * 1.011).toFixed(4),
  });
  out.push({
    time: now,
    open: +(p * 1.011).toFixed(4),
    high: +(p * 1.02).toFixed(4),
    low: +(p * 1.008).toFixed(4),
    close: +(p * 1.018).toFixed(4),
  });
  return out;
}
function engulfing(base: number): Candle[] {
  const out = bear(base * 1.03, 16);
  const p = out[out.length - 1].close;
  const now = Math.floor(Date.now() / 1000);
  const o1 = p,
    c1 = p * 0.994;
  out.push({
    time: now - 3 * 3600,
    open: +o1.toFixed(4),
    high: +(o1 * 1.002).toFixed(4),
    low: +(c1 * 0.998).toFixed(4),
    close: +c1.toFixed(4),
  });
  const o2 = c1 * 0.997,
    c2 = o1 * 1.012;
  out.push({
    time: now - 2 * 3600,
    open: +o2.toFixed(4),
    high: +(c2 * 1.003).toFixed(4),
    low: +(o2 * 0.998).toFixed(4),
    close: +c2.toFixed(4),
  });
  out.push({
    time: now - 3600,
    open: +c2.toFixed(4),
    high: +(c2 * 1.009).toFixed(4),
    low: +(c2 * 0.998).toFixed(4),
    close: +(c2 * 1.007).toFixed(4),
  });
  out.push({
    time: now,
    open: +(c2 * 1.007).toFixed(4),
    high: +(c2 * 1.015).toFixed(4),
    low: +(c2 * 1.003).toFixed(4),
    close: +(c2 * 1.013).toFixed(4),
  });
  return out;
}
function rsiOverbought(base: number): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  let p = base * 0.88;
  const out: Candle[] = [];
  for (let i = 34; i >= 0; i--) {
    const o = p,
      c = o * (1 + Math.random() * 0.022 + 0.005),
      h = c * 1.003,
      l = o * 0.998;
    out.push({
      time: now - i * 3600,
      open: +o.toFixed(4),
      high: +h.toFixed(4),
      low: +l.toFixed(4),
      close: +c.toFixed(4),
    });
    p = c;
  }
  return out;
}
function rsiOversold(base: number): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  let p = base * 1.12;
  const out: Candle[] = [];
  for (let i = 34; i >= 0; i--) {
    const o = p,
      c = o * (1 - Math.random() * 0.022 - 0.005),
      h = o * 1.003,
      l = c * 0.997;
    out.push({
      time: now - i * 3600,
      open: +o.toFixed(4),
      high: +h.toFixed(4),
      low: +l.toFixed(4),
      close: +c.toFixed(4),
    });
    p = c;
  }
  return out;
}
function bbSqueeze(base: number): Candle[] {
  const out = bull(base * 0.96, 20);
  const last = out[out.length - 1].close;
  const now = Math.floor(Date.now() / 1000);
  let p = last;
  for (let i = 10; i >= 1; i--) {
    const o = p,
      c = o + (Math.random() - 0.5) * 0.003 * o,
      h = Math.max(o, c) * 1.001,
      l = Math.min(o, c) * 0.999;
    out.push({
      time: now - i * 3600,
      open: +o.toFixed(4),
      high: +h.toFixed(4),
      low: +l.toFixed(4),
      close: +c.toFixed(4),
    });
    p = c;
  }
  const lp = out[out.length - 1].close;
  out.push({
    time: now,
    open: +lp.toFixed(4),
    high: +(lp * 1.025).toFixed(4),
    low: +(lp * 0.998).toFixed(4),
    close: +(lp * 1.022).toFixed(4),
  });
  return out;
}
function maCross(base: number): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  let p = base * 0.9;
  const out: Candle[] = [];
  for (let i = 55; i >= 0; i--) {
    const trend = i > 30 ? -0.002 : 0.007;
    const o = p,
      c = o * (1 + trend + Math.random() * 0.01 - 0.005),
      h = Math.max(o, c) * 1.004,
      l = Math.min(o, c) * 0.996;
    out.push({
      time: now - i * 3600,
      open: +o.toFixed(4),
      high: +h.toFixed(4),
      low: +l.toFixed(4),
      close: +c.toFixed(4),
    });
    p = c;
  }
  return out;
}
function supportBounce(base: number): Candle[] {
  const sp = base * 0.96;
  let p = base;
  const out: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 28; i >= 0; i--) {
    const o = p,
      rawC = o + (Math.random() - 0.52) * 0.014 * o,
      c = Math.max(rawC, sp + o * 0.002);
    out.push({
      time: now - i * 3600,
      open: +o.toFixed(4),
      high: +(Math.max(o, c) * 1.004).toFixed(4),
      low: +(Math.min(o, c) * 0.996).toFixed(4),
      close: +c.toFixed(4),
    });
    p = c;
  }
  return out;
}

const SCENARIOS: Scenario[] = [
  // ── Level 1-2: Trend basics ────────────────────────────────────────────────
  {
    id: "bull1",
    levelMin: 1,
    levelMax: 2,
    tag: "Tendencias",
    title: "Tendencia Alcista",
    setup:
      "Las velas suben de izquierda a derecha, formando máximos cada vez más altos.",
    question:
      "El precio lleva subiendo 3 días seguidos. ¿Qué harías ahora mismo?",
    answerType: "buy_sell",
    correct: "buy",
    explanation:
      "En una tendencia alcista clara, la estrategia más sencilla es ir con la tendencia. Los compradores dominan — comprar (BUY) es lo correcto.",
    tip: "Recuerda: 'La tendencia es tu amiga'. Opera siempre a favor del movimiento principal.",
    buildCandles: bull,
  },
  {
    id: "bear1",
    levelMin: 1,
    levelMax: 2,
    tag: "Tendencias",
    title: "Tendencia Bajista",
    setup:
      "El precio cae con fuerza, vela tras vela, con cuerpos rojos dominantes.",
    question:
      "El mercado lleva bajando toda la semana sin descanso. ¿Qué harías?",
    answerType: "buy_sell",
    correct: "sell",
    explanation:
      "Vender (SELL) o quedarte fuera es correcto. Los vendedores controlan el mercado — nunca compres contra una tendencia bajista fuerte.",
    tip: "Regla básica: no compres en tendencia bajista. Espera señales de reversión.",
    buildCandles: bear,
  },
  {
    id: "side1",
    levelMin: 1,
    levelMax: 2,
    tag: "Tendencias",
    title: "Mercado Lateral",
    setup: "El precio sube y baja pero no va claramente en ninguna dirección.",
    question:
      "El mercado lleva 10 días sin subir ni bajar de forma clara. ¿Qué harías?",
    answerType: "choice",
    options: [
      "Comprar en el centro del rango",
      "Vender sin razón clara",
      "Esperar — el mercado no tiene dirección",
      "Entrar en ambas direcciones a la vez",
    ],
    correct: 2,
    explanation:
      "En un mercado lateral lo mejor es esperar. Sin tendencia clara, las señales son falsas y el riesgo es alto. La paciencia es una ventaja.",
    tip: "Solo el 30% del tiempo el mercado tiene tendencia. El 70% está lateral — aprende a no operar en ese momento.",
    buildCandles: sideways,
  },
  // ── Level 2-3: Patterns ────────────────────────────────────────────────────
  {
    id: "hammer1",
    levelMin: 2,
    levelMax: 4,
    tag: "Patrones",
    title: "Patrón Martillo",
    setup:
      "Tras una bajada, aparece una vela con cuerpo pequeño arriba y mecha muy larga abajo.",
    question:
      "La última vela es un Martillo al final de una tendencia bajista. ¿Qué señal da?",
    answerType: "choice",
    options: [
      "Señal bajista — seguirá cayendo",
      "Señal alcista — posible rebote hacia arriba",
      "El mercado continuará lateral",
      "Es una señal débil, ignorar",
    ],
    correct: 1,
    explanation:
      "¡Exacto! El Martillo indica que los compradores rechazaron los precios bajos con fuerza. La mecha larga hacia abajo = los vendedores fallaron. Señal de compra.",
    tip: "Para confirmar el Martillo, espera que la siguiente vela cierre por encima del cuerpo. Nunca operes solo con un patrón.",
    buildCandles: hammer,
    showMA: true,
  },
  {
    id: "engulf1",
    levelMin: 2,
    levelMax: 4,
    tag: "Patrones",
    title: "Envolvente Alcista",
    setup:
      "Después de una caída, una vela verde grande 'envuelve' completamente a la roja anterior.",
    question:
      "Ves una vela verde que supera en tamaño a la roja anterior. ¿Qué harías?",
    answerType: "buy_sell",
    correct: "buy",
    explanation:
      "¡Correcto! La Envolvente Alcista (Bullish Engulfing) es una señal de reversión fuerte. Los compradores superaron completamente a los vendedores en esa vela.",
    tip: "La Envolvente Alcista es más potente si aparece en un nivel de soporte o después de una caída prolongada.",
    buildCandles: engulfing,
    showMA: true,
  },
  // ── Level 3-5: Support/Resistance ─────────────────────────────────────────
  {
    id: "support1",
    levelMin: 3,
    levelMax: 5,
    tag: "Soporte",
    title: "Rebote en Soporte",
    setup:
      "El precio ha tocado el mismo nivel mínimo 3 veces y siempre rebotó hacia arriba desde ahí.",
    question:
      "El precio llega por cuarta vez a ese nivel mínimo. ¿Qué esperarías que pase?",
    answerType: "choice",
    options: [
      "Romperá hacia abajo definitivamente",
      "Probablemente rebotará hacia arriba de nuevo",
      "El precio se quedará exactamente ahí",
      "No hay forma de saberlo — salir del mercado",
    ],
    correct: 1,
    explanation:
      "Un soporte testado 3+ veces es muy fuerte. Lo más probable estadísticamente es un rebote. Muchos traders lo usan como zona de entrada (compra).",
    tip: "Cuanto más veces se respeta un soporte, más fuerte es. Pero si rompe, la caída puede ser violenta.",
    buildCandles: supportBounce,
    showMA: true,
  },
  // ── Level 5-7: Volume + MA ─────────────────────────────────────────────────
  {
    id: "maCross1",
    levelMin: 5,
    levelMax: 7,
    tag: "Medias Móviles",
    title: "Cruce Dorado (Golden Cross)",
    setup:
      "La MA20 (línea azul) acaba de cruzar POR ENCIMA de la MA50 (línea naranja) mientras el precio sube.",
    question:
      "La MA20 cruza hacia arriba a la MA50. ¿Qué señal técnica es esta?",
    answerType: "choice",
    options: [
      "Señal bajista — vender",
      "Golden Cross — señal alcista fuerte — comprar",
      "Death Cross — señal bajista",
      "Sin importancia — ignorar",
    ],
    correct: 1,
    explanation:
      "¡Exacto! Cuando la MA rápida (20) cruza hacia arriba a la MA lenta (50) se llama Golden Cross. Es una de las señales alcistas más usadas en trading.",
    tip: "El Golden Cross funciona mejor en marcos de tiempo altos (4H, 1D). En marcos bajos puede dar falsas señales.",
    buildCandles: maCross,
    showMA: true,
  },
  // ── Level 7+: RSI + BB ─────────────────────────────────────────────────────
  {
    id: "rsi1",
    levelMin: 7,
    levelMax: 99,
    tag: "RSI",
    title: "RSI en Sobrecompra",
    setup:
      "El precio ha subido fuerte y el RSI está por encima de 70 (zona roja). Indica sobrecompra.",
    question:
      "El RSI supera 70 después de una subida intensa. ¿Qué suele pasar?",
    answerType: "choice",
    options: [
      "El precio seguirá subiendo infinitamente",
      "Señal de sobrecompra — posible corrección o pausa",
      "Señal de compra — entrar ahora",
      "El RSI no sirve para nada",
    ],
    correct: 1,
    explanation:
      "RSI > 70 = sobrecompra. El precio puede corregir o consolidar. No significa venta inmediata, pero sí que hay que ser cuidadoso comprando aquí.",
    tip: "RSI > 70 avisa de posible agotamiento. Espera confirmación (vela bajista, divergencia) antes de vender.",
    buildCandles: rsiOverbought,
    showRSI: true,
    showMA: true,
  },
  {
    id: "rsi2",
    levelMin: 7,
    levelMax: 99,
    tag: "RSI",
    title: "RSI en Sobreventa",
    setup:
      "Tras una fuerte caída, el RSI cae por debajo de 30 (zona verde). Indica sobreventa.",
    question:
      "El RSI está por debajo de 30 al final de una caída fuerte. ¿Qué harías?",
    answerType: "buy_sell",
    correct: "buy",
    explanation:
      "¡Correcto! RSI < 30 indica sobreventa — el precio puede estar 'demasiado barato'. Es una zona potencial de rebote o reversión alcista.",
    tip: "RSI < 30 + patrón de vela alcista (hammer, engulfing) = señal de entrada muy potente.",
    buildCandles: rsiOversold,
    showRSI: true,
    showMA: true,
  },
  {
    id: "bb1",
    levelMin: 7,
    levelMax: 99,
    tag: "Bollinger Bands",
    title: "Expansión de Bollinger Bands",
    setup:
      "Las bandas de Bollinger estaban muy juntas (poca volatilidad) y de repente el precio rompe la banda superior con fuerza.",
    question:
      "El precio rompe la banda superior de Bollinger después de una compresión. ¿Qué significa?",
    answerType: "choice",
    options: [
      "El precio bajará inmediatamente",
      "Inicio de movimiento fuerte — posible compra con gestión de riesgo",
      "Las bandas no tienen utilidad",
      "Señal de venta siempre",
    ],
    correct: 1,
    explanation:
      "Una rotura de Bollinger tras compresión (squeeze) suele indicar el inicio de un movimiento fuerte. No es garantía, pero si el volumen acompaña, puede ser una buena entrada.",
    tip: "El 'BB Squeeze' es cuando las bandas se acercan mucho. La energía acumulada suele liberar un movimiento explosivo.",
    buildCandles: bbSqueeze,
    showBB: true,
    showMA: true,
  },
];

// ─── Practice Session ─────────────────────────────────────────────────────────
interface SessionState {
  scenarios: Scenario[];
  current: number;
  answered: boolean;
  userAnswer: "buy" | "sell" | number | null;
  score: { correct: number; total: number };
  done: boolean;
}

function buildSession(userLevel: number): SessionState {
  const pool = SCENARIOS.filter(
    (s) => userLevel >= s.levelMin && userLevel <= s.levelMax,
  );
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  return {
    scenarios: shuffled,
    current: 0,
    answered: false,
    userAnswer: null,
    score: { correct: 0, total: 0 },
    done: false,
  };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Simulator() {
  const { user } = useAuth();
  const userLevel = user?.level ?? 1;

  const [asset, setAsset] = useState(ASSETS[0]);
  const [tf, setTf] = useState(TIMEFRAMES[1]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [mode, setMode] = useState<"trading" | "practice">("trading");

  // Trading extras
  const [showBB, setShowBB] = useState(false);
  const [showVol, setShowVol] = useState(true);
  const [showRSI, setShowRSI] = useState(false);
  const [tradeAmt, setTradeAmt] = useState("1000");

  // Practice session
  const [session, setSession] = useState<SessionState | null>(null);
  const [scenarioCandles, setScenarioCandles] = useState<Candle[]>([]);

  const { data: portfolio, refetch: refetchPortfolio } = useGetPortfolio();
  const { data: history, refetch: refetchHistory } = useGetTradeHistory();
  const tradeMutation = useExecuteTrade();

  // Chart refs
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const chartMain = useRef<any>(null);
  const chartVol = useRef<any>(null);
  const chartRSI = useRef<any>(null);
  const sCandl = useRef<any>(null);
  const sMA20 = useRef<any>(null);
  const sMA50 = useRef<any>(null);
  const sBBUp = useRef<any>(null);
  const sBBMid = useRef<any>(null);
  const sBBLow = useRef<any>(null);
  const sVol = useRef<any>(null);
  const sRSI = useRef<any>(null);
  const sR70 = useRef<any>(null);
  const sR30 = useRef<any>(null);

  // ── Build charts ──────────────────────────────────────────────────────────
  const buildCharts = useCallback(
    (showVolume: boolean, showRsiPanel: boolean) => {
      [chartMain, chartVol, chartRSI].forEach((r) => {
        try {
          r.current?.remove();
        } catch {}
        r.current = null;
      });
      if (!mainRef.current) return;

      const w = mainRef.current.clientWidth || 600;
      const cm = createChart(mainRef.current, {
        ...CHART_THEME,
        width: w,
        height: 380,
      });
      sCandl.current = cm.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#e11d48",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#e11d48",
      });
      sMA20.current = cm.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      sMA50.current = cm.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      sBBUp.current = cm.addSeries(LineSeries, {
        color: "rgba(168,85,247,0.55)",
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      sBBMid.current = cm.addSeries(LineSeries, {
        color: "rgba(168,85,247,0.3)",
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      sBBLow.current = cm.addSeries(LineSeries, {
        color: "rgba(168,85,247,0.55)",
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chartMain.current = cm;

      if (showVolume && volRef.current) {
        const cv = createChart(volRef.current, {
          ...CHART_THEME,
          width: w,
          height: 70,
          rightPriceScale: {
            borderColor: "#1e293b",
            scaleMargins: { top: 0.05, bottom: 0 },
          },
          timeScale: { visible: false },
        });
        sVol.current = cv.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
        });
        chartVol.current = cv;
        cm.timeScale().subscribeVisibleLogicalRangeChange((r) => {
          if (r) cv.timeScale().setVisibleLogicalRange(r);
        });
        cv.timeScale().subscribeVisibleLogicalRangeChange((r) => {
          if (r) cm.timeScale().setVisibleLogicalRange(r);
        });
      }

      if (showRsiPanel && rsiRef.current) {
        const cr = createChart(rsiRef.current, {
          ...CHART_THEME,
          width: w,
          height: 110,
          rightPriceScale: {
            borderColor: "#1e293b",
            scaleMargins: { top: 0.1, bottom: 0.1 },
          },
          timeScale: {
            borderColor: "#1e293b",
            timeVisible: true,
            secondsVisible: false,
          },
        });
        sRSI.current = cr.addSeries(LineSeries, {
          color: "#a855f7",
          lineWidth: 2,
          title: "RSI",
        });
        sR70.current = cr.addSeries(LineSeries, {
          color: "rgba(239,68,68,0.35)",
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        sR30.current = cr.addSeries(LineSeries, {
          color: "rgba(16,185,129,0.35)",
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        chartRSI.current = cr;
        cm.timeScale().subscribeVisibleLogicalRangeChange((r) => {
          if (r) cr.timeScale().setVisibleLogicalRange(r);
        });
      }

      const resize = () => {
        const nw = mainRef.current?.clientWidth || w;
        cm.applyOptions({ width: nw });
        chartVol.current?.applyOptions({ width: nw });
        chartRSI.current?.applyOptions({ width: nw });
      };
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    },
    [],
  );

  // ── Push data to charts ───────────────────────────────────────────────────
  const pushData = useCallback(
    (
      data: Candle[],
      opts: { bb?: boolean; vol?: boolean; rsi?: boolean; ma?: boolean },
    ) => {
      if (!sCandl.current || !data.length) return;
      const sorted = [...data].sort((a, b) => a.time - b.time);
      sCandl.current.setData(sorted);
      if (opts.ma !== false) {
        sMA20.current?.setData(computeMA(sorted, 20));
        sMA50.current?.setData(computeMA(sorted, 50));
      } else {
        sMA20.current?.setData([]);
        sMA50.current?.setData([]);
      }
      if (opts.bb) {
        const bb = computeBB(sorted);
        sBBUp.current?.setData(
          bb.map((b) => ({ time: b.time, value: b.upper })),
        );
        sBBMid.current?.setData(
          bb.map((b) => ({ time: b.time, value: b.mid })),
        );
        sBBLow.current?.setData(
          bb.map((b) => ({ time: b.time, value: b.lower })),
        );
      } else {
        sBBUp.current?.setData([]);
        sBBMid.current?.setData([]);
        sBBLow.current?.setData([]);
      }
      if (opts.vol)
        sVol.current?.setData(
          genVolBars(sorted, sorted[sorted.length - 1].close * 100),
        );
      else sVol.current?.setData([]);
      if (opts.rsi) {
        const rsi = computeRSI(sorted);
        sRSI.current?.setData(rsi);
        sR70.current?.setData(sorted.map((c) => ({ time: c.time, value: 70 })));
        sR30.current?.setData(sorted.map((c) => ({ time: c.time, value: 30 })));
      } else {
        sRSI.current?.setData([]);
        sR70.current?.setData([]);
        sR30.current?.setData([]);
      }
      chartMain.current?.timeScale().fitContent();
      chartVol.current?.timeScale().fitContent();
      chartRSI.current?.timeScale().fitContent();
    },
    [],
  );

  // ── Init charts on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = buildCharts(showVol, showRSI);
    return () => {
      cleanup?.();
      [chartMain, chartVol, chartRSI].forEach((r) => {
        try {
          r.current?.remove();
        } catch {}
        r.current = null;
      });
    };
  }, [buildCharts]); // eslint-disable-line

  // ── Rebuild charts when indicators toggle ─────────────────────────────────
  useEffect(() => {
    const cleanup = buildCharts(showVol, showRSI);
    if (mode === "trading") {
      const c = genCandles(
        asset.basePrice,
        asset.volatility,
        tf.count,
        tf.seconds,
      );
      setCandles(c);
      setTimeout(
        () => pushData(c, { bb: showBB, vol: showVol, rsi: showRSI }),
        50,
      );
    }
    return () => cleanup?.();
  }, [showBB, showVol, showRSI]); // eslint-disable-line

  // ── Trading data on asset/tf change ───────────────────────────────────────
  useEffect(() => {
    if (mode !== "trading") return;
    const c = genCandles(
      asset.basePrice,
      asset.volatility,
      tf.count,
      tf.seconds,
    );
    setCandles(c);
    setTimeout(
      () => pushData(c, { bb: showBB, vol: showVol, rsi: showRSI }),
      50,
    );
  }, [asset, tf, mode]); // eslint-disable-line

  // ── Practice mode init ────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "practice") return;
    const s = buildSession(userLevel);
    setSession(s);
  }, [mode, userLevel]);

  useEffect(() => {
    if (!session || session.done) return;
    const sc = session.scenarios[session.current];
    if (!sc) return;
    const c = sc.buildCandles(asset.basePrice);
    setScenarioCandles(c);
    const rsiNeeded = !!sc.showRSI;
    const needRebuild = rsiNeeded !== showRSI || !!sc.showBB !== showBB;
    const doLoad = () => {
      pushData(c, {
        bb: sc.showBB,
        vol: true,
        rsi: sc.showRSI,
        ma: sc.showMA !== false,
      });
    };
    if (needRebuild) {
      const cleanup = buildCharts(true, rsiNeeded);
      setTimeout(doLoad, 60);
      return () => cleanup?.();
    } else {
      setTimeout(doLoad, 30);
    }
  }, [session?.current, session?.scenarios]); // eslint-disable-line

  // ── Live tick (trading only) ──────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "trading") return;
    const id = setInterval(() => {
      setCandles((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        const d = (Math.random() - 0.5) * asset.volatility * last.close;
        const nc = +(last.close + d).toFixed(4);
        const upd = [
          ...prev.slice(0, -1),
          {
            ...last,
            close: nc,
            high: Math.max(last.high, nc),
            low: Math.min(last.low, nc),
          },
        ];
        if (Date.now() / 1000 - last.time > tf.seconds * 0.5)
          upd.push({
            time: Math.floor(Date.now() / 1000),
            open: nc,
            high: nc,
            low: nc,
            close: nc,
          });
        return upd;
      });
    }, 2500);
    return () => clearInterval(id);
  }, [asset, tf, mode]);

  useEffect(() => {
    if (!sCandl.current || !candles.length || mode !== "trading") return;
    try {
      sCandl.current.update(candles[candles.length - 1]);
    } catch {}
  }, [candles, mode]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const last = candles[candles.length - 1];
  const curP = last?.close ?? asset.basePrice;
  const openP = last?.open ?? asset.basePrice;
  const isUp = curP >= openP;
  const chg = curP - openP;
  const chgPct = openP !== 0 ? (chg / openP) * 100 : 0;

  // ── Trade ─────────────────────────────────────────────────────────────────
  const doTrade = async (action: "buy" | "sell") => {
    const amt = parseFloat(tradeAmt);
    if (isNaN(amt) || amt <= 0) return;
    try {
      await tradeMutation.mutateAsync({
        data: { symbol: asset.symbol, action, amount: amt },
      });
      refetchPortfolio();
      refetchHistory();
      setTradeAmt("");
    } catch (e) {
      console.error(e);
    }
  };

  // ── Practice answer ───────────────────────────────────────────────────────
  const answerPractice = (answer: "buy" | "sell" | number) => {
    if (!session || session.answered) return;
    const sc = session.scenarios[session.current];
    const isCorrect = answer === sc.correct;
    setSession((s) =>
      s
        ? {
            ...s,
            answered: true,
            userAnswer: answer,
            score: {
              correct: s.score.correct + (isCorrect ? 1 : 0),
              total: s.score.total + 1,
            },
          }
        : s,
    );
  };

  const nextScenario = () => {
    setSession((s) => {
      if (!s) return s;
      const next = s.current + 1;
      if (next >= s.scenarios.length)
        return { ...s, done: true, answered: false };
      return { ...s, current: next, answered: false, userAnswer: null };
    });
  };

  // ── What-to-study text based on level ─────────────────────────────────────
  const studyLabel =
    userLevel <= 2
      ? "Aprendiendo: Tendencias básicas"
      : userLevel <= 4
        ? "Aprendiendo: Patrones de velas"
        : userLevel <= 6
          ? "Aprendiendo: Soporte y resistencia"
          : "Aprendiendo: Indicadores técnicos (RSI, BB, MAs)";

  const currentScenario = session ? session.scenarios[session.current] : null;
  const isCorrect =
    session?.answered && session.userAnswer === currentScenario?.correct;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={cn("space-y-4 pb-10", mode === "practice" && "pb-4")}>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Trading Simulado</h1>
          <p className="text-muted-foreground text-sm">
            Sin riesgo real · aprende operando
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("trading")}
            className={cn(
              "px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-1.5 transition-all",
              mode === "trading"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >
            <BarChart2 className="w-4 h-4" /> Operar
          </button>
          <button
            onClick={() => setMode("practice")}
            className={cn(
              "px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-1.5 transition-all",
              mode === "practice"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >
            <Brain className="w-4 h-4" /> Practicar
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════════════ TRADING MODE ═══════════════ */}
        {mode === "trading" && (
          <motion.div
            key="trading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-4"
          >
            {/* Chart */}
            <div className="lg:col-span-2 space-y-3">
              <div className="glass-panel rounded-2xl overflow-hidden">
                {/* Toolbar */}
                <div className="p-3 border-b border-white/5 flex flex-wrap items-center gap-2">
                  <div className="flex gap-1 flex-wrap">
                    {ASSETS.map((a) => (
                      <button
                        key={a.symbol}
                        onClick={() => setAsset(a)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-semibold text-xs transition-colors",
                          asset.symbol === a.symbol
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80",
                        )}
                      >
                        {a.symbol}
                      </button>
                    ))}
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex gap-1">
                    {TIMEFRAMES.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => setTf(t)}
                        className={cn(
                          "px-2 py-1 rounded-lg font-mono text-xs transition-colors",
                          tf.label === t.label
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex gap-1">
                    {(
                      [
                        ["BB", "text-purple-400", showBB, setShowBB],
                        ["VOL", "text-slate-400", showVol, setShowVol],
                        ["RSI", "text-violet-400", showRSI, setShowRSI],
                      ] as any[]
                    ).map(([lbl, col, val, set]) => (
                      <button
                        key={lbl}
                        onClick={() => set((v: boolean) => !v)}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-xs font-bold transition-colors border",
                          val
                            ? `bg-white/10 border-white/20 ${col}`
                            : "border-transparent text-muted-foreground hover:bg-white/5",
                        )}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price row */}
                <div className="px-4 py-2 flex gap-5 items-baseline border-b border-white/5">
                  <span className="text-xl font-bold font-mono">
                    {formatCurrency(curP)}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold flex items-center gap-0.5",
                      isUp ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {isUp ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {formatCurrency(Math.abs(chg))} ({chgPct.toFixed(2)}%)
                  </span>
                  <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-blue-400 inline-block rounded" />
                      MA20
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-amber-400 inline-block rounded" />
                      MA50
                    </span>
                    {showBB && (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-purple-400 inline-block rounded" />
                        BB
                      </span>
                    )}
                  </div>
                </div>

                <div ref={mainRef} className="w-full" />
                {showVol && (
                  <div className="border-t border-white/5">
                    <p className="px-3 pt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      Volumen
                    </p>
                    <div ref={volRef} className="w-full" />
                  </div>
                )}
                {showRSI && (
                  <div className="border-t border-white/5">
                    <p className="px-3 pt-1 text-[9px] font-bold uppercase tracking-widest text-violet-400">
                      RSI (14) · <span className="text-rose-400/60">70</span> ·{" "}
                      <span className="text-emerald-400/60">30</span>
                    </p>
                    <div ref={rsiRef} className="w-full" />
                  </div>
                )}
              </div>

              {/* Trade panel */}
              <div className="glass-panel p-4 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Ejecutar operación · {asset.symbol}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={tradeAmt}
                      onChange={(e) => setTradeAmt(e.target.value)}
                      className="w-full bg-background border-2 border-border rounded-xl py-3 pl-7 pr-4 font-mono focus:outline-none focus:border-primary transition-all text-sm"
                    />
                  </div>
                  <div className="flex gap-2 sm:w-2/5">
                    <button
                      onClick={() => doTrade("buy")}
                      disabled={tradeMutation.isPending || !tradeAmt}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl py-3 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all text-sm"
                    >
                      COMPRAR
                    </button>
                    <button
                      onClick={() => doTrade("sell")}
                      disabled={tradeMutation.isPending || !tradeAmt}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl py-3 shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all text-sm"
                    >
                      VENDER
                    </button>
                  </div>
                </div>
                {tradeMutation.isError && (
                  <p className="text-rose-400 text-xs mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Saldo insuficiente o posición inválida.
                  </p>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-3">
              <div className="glass-panel p-4 rounded-2xl">
                <p className="text-xs text-muted-foreground mb-1">
                  Saldo disponible
                </p>
                <p className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(portfolio?.balance || 10000)}
                </p>
              </div>
              <div className="glass-panel p-4 rounded-2xl">
                <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                  <Wallet className="w-4 h-4 text-primary" />
                  Portfolio
                </h3>
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="text-xl font-bold font-mono mb-3">
                  {formatCurrency(portfolio?.totalValue || 0)}
                </p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Posiciones
                </p>
                {!portfolio?.positions.length ? (
                  <p className="text-xs text-muted-foreground text-center py-3 bg-white/5 rounded-xl">
                    Sin posiciones
                  </p>
                ) : (
                  portfolio.positions.map((pos) => (
                    <div
                      key={pos.symbol}
                      className="flex justify-between items-center p-2.5 bg-secondary/50 rounded-xl mb-1.5"
                    >
                      <div>
                        <p className="font-bold text-sm">{pos.symbol}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {pos.shares.toFixed(4)} u.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs">
                          {formatCurrency(pos.value)}
                        </p>
                        <p
                          className={cn(
                            "text-[10px]",
                            pos.profitLoss >= 0
                              ? "text-emerald-400"
                              : "text-rose-400",
                          )}
                        >
                          {pos.profitLoss >= 0 ? "+" : ""}
                          {formatCurrency(pos.profitLoss)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="glass-panel p-4 rounded-2xl">
                <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                  <History className="w-4 h-4 text-primary" />
                  Operaciones
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {!history?.length ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Sin operaciones
                    </p>
                  ) : (
                    history.slice(0, 8).map((t) => (
                      <div
                        key={t.id}
                        className="flex justify-between py-1.5 border-b border-white/5 last:border-0"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-[9px] px-1 py-0.5 rounded font-bold uppercase",
                                t.action === "buy"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-rose-600/20 text-rose-400",
                              )}
                            >
                              {t.action === "buy" ? "COMPRA" : "VENTA"}
                            </span>
                            <span className="font-bold text-xs">
                              {t.symbol}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(t.createdAt).toLocaleDateString("es", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <p className="font-mono text-xs self-center">
                          {formatCurrency(t.amount)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════ PRACTICE MODE ═══════════════ */}
        {mode === "practice" && (
          <motion.div
            key="practice"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {/* Session complete */}
            {session?.done ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Star className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1">
                    ¡Sesión completada!
                  </h2>
                  <p className="text-muted-foreground">
                    {session.score.correct} de {session.score.total} respuestas
                    correctas
                  </p>
                  <p className="text-3xl font-bold text-primary mt-2">
                    {Math.round(
                      (session.score.correct / session.score.total) * 100,
                    )}
                    %
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSession(buildSession(userLevel))}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all"
                  >
                    Nueva sesión
                  </button>
                  <button
                    onClick={() => setMode("trading")}
                    className="px-6 py-3 bg-secondary text-foreground rounded-xl font-semibold hover:bg-secondary/80 transition-all"
                  >
                    Ir a operar
                  </button>
                </div>
              </div>
            ) : currentScenario ? (
              <div className="space-y-0">
                {/* Top bar */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                      {currentScenario.tag}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {studyLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono">
                      {session.current + 1}/{session.scenarios.length}
                    </span>
                    <div className="flex gap-1">
                      {session.scenarios.map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-6 h-1.5 rounded-full transition-colors",
                            i < session.current
                              ? "bg-primary"
                              : i === session.current
                                ? "bg-primary/60"
                                : "bg-white/10",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chart panel (full width) */}
                <div className="glass-panel rounded-2xl overflow-hidden">
                  <div className="px-4 pt-3 pb-2 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm">
                        {currentScenario.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {currentScenario.setup}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0 ml-4">
                      {currentScenario.showMA !== false && (
                        <>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-blue-400 inline-block rounded" />
                            MA20
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-amber-400 inline-block rounded" />
                            MA50
                          </span>
                        </>
                      )}
                      {currentScenario.showBB && (
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-0.5 bg-purple-400 inline-block rounded" />
                          BB
                        </span>
                      )}
                      {currentScenario.showRSI && (
                        <span className="text-violet-400 font-bold">RSI</span>
                      )}
                    </div>
                  </div>
                  <div ref={mainRef} className="w-full" />
                  <div className="border-t border-white/5">
                    <p className="px-3 pt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      Volumen
                    </p>
                    <div ref={volRef} className="w-full" />
                  </div>
                  {currentScenario.showRSI && (
                    <div className="border-t border-white/5">
                      <p className="px-3 pt-1 text-[9px] font-bold uppercase tracking-widest text-violet-400">
                        RSI (14)
                      </p>
                      <div ref={rsiRef} className="w-full" />
                    </div>
                  )}
                </div>

                {/* Question panel */}
                <div className="glass-panel rounded-2xl p-5 mt-3">
                  {!session.answered ? (
                    <>
                      <p className="font-semibold text-sm mb-4">
                        {currentScenario.question}
                      </p>
                      {currentScenario.answerType === "buy_sell" ? (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => answerPractice("buy")}
                            className="py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-lg shadow-lg shadow-emerald-500/20 transition-all flex flex-col items-center gap-1"
                          >
                            <TrendingUp className="w-6 h-6" />
                            <span>COMPRAR</span>
                            <span className="text-xs opacity-70 font-normal">
                              Precio va a subir
                            </span>
                          </button>
                          <button
                            onClick={() => answerPractice("sell")}
                            className="py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-lg shadow-lg shadow-rose-600/20 transition-all flex flex-col items-center gap-1"
                          >
                            <TrendingUp className="w-6 h-6 rotate-180" />
                            <span>VENDER</span>
                            <span className="text-xs opacity-70 font-normal">
                              Precio va a bajar
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {currentScenario.options?.map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => answerPractice(idx)}
                              className="text-left p-3.5 bg-secondary border-2 border-border rounded-xl text-sm font-medium hover:border-primary/50 transition-all"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {/* Result banner */}
                      <div
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border mb-4",
                          isCorrect
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-rose-600/10 border-rose-600/30",
                        )}
                      >
                        {isCorrect ? (
                          <CheckCircle className="w-7 h-7 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-7 h-7 text-rose-400 flex-shrink-0" />
                        )}
                        <div>
                          <p
                            className={cn(
                              "font-bold",
                              isCorrect ? "text-emerald-300" : "text-rose-300",
                            )}
                          >
                            {isCorrect
                              ? "¡Correcto! Bien analizado."
                              : "No es correcto esta vez."}
                          </p>
                          <p className="text-sm mt-1 text-foreground/80">
                            {currentScenario.explanation}
                          </p>
                        </div>
                      </div>

                      {/* Tip */}
                      <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl mb-4">
                        <Star className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          <span className="text-primary font-semibold">
                            Consejo:{" "}
                          </span>
                          {currentScenario.tip}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          Correctas:{" "}
                          <span className="text-emerald-400 font-bold">
                            {session.score.correct}
                          </span>{" "}
                          / {session.score.total}
                        </div>
                        <button
                          onClick={nextScenario}
                          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                        >
                          {session.current + 1 < session.scenarios.length
                            ? "Siguiente gráfico"
                            : "Ver resultado"}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Locked notice for high-level content */}
                {userLevel < 7 && (
                  <div className="glass-panel p-3 rounded-xl mt-3 flex items-center gap-3">
                    <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground font-semibold">
                        Nivel 7+ desbloquea:
                      </span>{" "}
                      Sesiones con RSI, Bollinger Bands y cruces de medias
                      móviles.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
