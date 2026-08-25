import React, { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './index.css';

type Page = 'landing' | 'login' | 'register' | 'dashboard' | 'signals' | 'trading' | 'autotrade' | 'history' | 'settings' | 'billing' | 'admin';

const plans = [
  { name: 'Grátis', price: '7 dias trial', cta: 'Testar grátis', features: ['Paper trading', 'Sinais básicos', 'Binance testnet'] },
  { name: 'Basic', price: '15.000 Kz/mês', cta: 'Assinar Basic', features: ['Signal Center', 'Trading manual', 'Risk Manager 1%'] },
  { name: 'Pro', price: '45.000 Kz/mês', cta: 'Assinar Pro', featured: true, features: ['Autotrading', 'Analytics avançado', 'Score mínimo configurável'] },
  { name: 'Enterprise', price: '120.000 Kz/mês', cta: 'Falar com suporte', features: ['Multi-conta', 'Suporte premium', 'Relatórios personalizados'] },
];
const signals = [
  { pair: 'BTC/USDT', side: 'LONG', entry: 64200, sl: 62800, tp: 71200, score: 88, tf: '4h' },
  { pair: 'ETH/USDT', side: 'LONG', entry: 3180, sl: 3090, tp: 3630, score: 76, tf: '1h' },
  { pair: 'SOL/USDT', side: 'SHORT', entry: 146, sl: 151, tp: 121, score: 72, tf: '15m' },
];
const equity = Array.from({ length: 14 }, (_, i) => ({ day: `${i + 1}`, value: 2000 + i * 155 + Math.sin(i) * 120 }));
const pnl = [{ name: 'WIN', value: 68 }, { name: 'LOSS', value: 32 }];

function money(value: number) { return `${Math.round(value).toLocaleString('pt-AO').replace(/,/g, '.')} USDT`; }
function Kpi({ label, value, accent = 'text-emerald-300' }: { label: string; value: string; accent?: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-slate-400">{label}</p><strong className={`mt-2 block text-2xl ${accent}`}>{value}</strong></div>; }
function Button({ children, onClick, soft = false }: { children: React.ReactNode; onClick?: () => void; soft?: boolean }) { return <button onClick={onClick} className={`rounded-xl px-4 py-2 font-semibold transition ${soft ? 'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10' : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'}`}>{children}</button>; }

export default function App() {
  const [page, setPage] = useState<Page>('landing');
  const [minScore, setMinScore] = useState(70);
  const visibleSignals = useMemo(() => signals.filter((signal) => signal.score >= minScore), [minScore]);
  const nav: Page[] = ['dashboard', 'signals', 'trading', 'autotrade', 'history', 'settings', 'billing', 'admin'];

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <button onClick={() => setPage('landing')} className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 font-black text-slate-950">AO</span><span className="text-xl font-bold">Trade AO</span></button>
        <nav className="hidden gap-2 lg:flex">{nav.map((item) => <button key={item} onClick={() => setPage(item)} className={`rounded-lg px-3 py-2 text-sm capitalize ${page === item ? 'bg-emerald-400 text-slate-950' : 'text-slate-300 hover:bg-white/10'}`}>{item}</button>)}</nav>
        <div className="flex gap-2"><Button soft onClick={() => setPage('login')}>Entrar</Button><Button onClick={() => setPage('register')}>Criar conta</Button></div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-10">
      {page === 'landing' && <section className="space-y-16">
        <div className="grid items-center gap-10 py-12 lg:grid-cols-[1.1fr_.9fr]">
          <div><p className="mb-4 text-emerald-300">Plataforma SaaS para traders angolanos</p><h1 className="text-5xl font-black tracking-tight md:text-7xl">Trade AO — trading inteligente para Angolanos</h1><p className="mt-6 max-w-2xl text-lg text-slate-300">Conecta a tua Binance e deixa a inteligência de mercado trabalhar por ti, com sinais, risk manager, analytics e pagamentos em Kwanza via Multicaixa Express ou cartões.</p><div className="mt-8 flex flex-wrap gap-3"><Button onClick={() => setPage('register')}>Testar grátis 7 dias</Button><Button soft onClick={() => setPage('billing')}>Ver planos</Button></div></div>
          <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 to-slate-900 p-6 shadow-2xl shadow-emerald-950"><ResponsiveContainer width="100%" height={320}><AreaChart data={equity}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.8}/><stop offset="95%" stopColor="#34d399" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="day" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><Tooltip/><Area type="monotone" dataKey="value" stroke="#34d399" fill="url(#g)"/></AreaChart></ResponsiveContainer></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">{['Conecta a tua Binance em testnet ou live', 'Analisa sinais com RSI, EMA, Bollinger, MACD e volume', 'Trade com SL obrigatório, RR mínimo e circuit breaker'].map((text, i) => <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6" key={text}><span className="text-emerald-300">0{i + 1}</span><h3 className="mt-3 text-xl font-bold">{text}</h3></div>)}</div>
        <PlanGrid setPage={setPage} />
        <footer className="border-t border-white/10 py-8 text-slate-400">Junte-se a +1.248 traders angolanos • Suporte por WhatsApp e email • Domínio recomendado: tradeao.co.ao</footer>
      </section>}

      {(page === 'login' || page === 'register') && <AuthCard mode={page} setPage={setPage} />}
      {page === 'dashboard' && <Dashboard />}
      {page === 'signals' && <section className="space-y-6"><Title title="Signal Center" subtitle="Sinais ao vivo atualizados por candle em 15m, 1h e 4h."/><label className="block max-w-xs text-sm text-slate-300">Score mínimo: {minScore}<input className="mt-2 w-full accent-emerald-400" type="range" min="50" max="95" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}/></label><SignalsTable rows={visibleSignals} /></section>}
      {page === 'trading' && <section className="space-y-6"><Title title="Trading Manual" subtitle="Abre LONG/SHORT com confirmação de SL, TP, montante e risco calculado."/><SignalsTable rows={signals} trading /></section>}
      {page === 'autotrade' && <Autotrade />}
      {page === 'history' && <History />}
      {page === 'settings' && <Settings />}
      {page === 'billing' && <PlanGrid setPage={setPage} />}
      {page === 'admin' && <Admin />}
    </main>
  </div>;
}

function Title({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-3xl font-black">{title}</h2><p className="mt-2 text-slate-400">{subtitle}</p></div>; }
function AuthCard({ mode, setPage }: { mode: 'login' | 'register'; setPage: (p: Page) => void }) { return <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8"><Title title={mode === 'login' ? 'Entrar' : 'Criar conta'} subtitle="Access token de 15 min e refresh token de 7 dias no backend."/><input placeholder="Email" className="mt-6 w-full rounded-xl border border-white/10 bg-slate-900 p-3"/><input placeholder="Password" type="password" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 p-3"/><div className="mt-5"><Button onClick={() => setPage('dashboard')}>{mode === 'login' ? 'Entrar' : 'Começar trial'}</Button></div></div>; }
function Dashboard() { return <section className="space-y-6"><Title title="Dashboard Principal" subtitle="Equity curve, PnL, posições abertas e saldo Binance em USDT."/><div className="grid gap-4 md:grid-cols-5"><Kpi label="PnL diário" value="128 USDT"/><Kpi label="PnL mensal" value="1.240 USDT"/><Kpi label="Win rate" value="68%"/><Kpi label="Profit factor" value="2.4"/><Kpi label="Saldo Binance" value={money(2500)}/></div><div className="grid gap-5 lg:grid-cols-[1.6fr_.8fr]"><ChartCard/><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><h3 className="mb-4 font-bold">Trades abertas</h3>{signals.slice(0,2).map((s) => <div className="mb-3 rounded-xl bg-slate-900 p-4" key={s.pair}><b>{s.pair}</b><p className="text-sm text-slate-400">{s.side} • Entrada {s.entry} • SL {s.sl} • TP {s.tp}</p></div>)}</div></div></section>; }
function ChartCard() { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><ResponsiveContainer width="100%" height={320}><AreaChart data={equity}><CartesianGrid stroke="#1e293b"/><XAxis dataKey="day" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><Tooltip/><Area type="monotone" dataKey="value" stroke="#34d399" fill="#064e3b"/></AreaChart></ResponsiveContainer></div>; }
function SignalsTable({ rows, trading = false }: { rows: typeof signals; trading?: boolean }) { return <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[760px] text-left"><thead className="bg-white/5 text-slate-400"><tr>{['Par','Direção','Entrada','SL','TP','Score','Timeframe','Ação'].map(h => <th className="p-4" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((s) => <tr className="border-t border-white/10" key={s.pair}><td className="p-4 font-bold">{s.pair}</td><td className={s.side === 'LONG' ? 'p-4 text-emerald-300' : 'p-4 text-rose-300'}>{s.side}</td><td className="p-4">{s.entry}</td><td className="p-4">{s.sl}</td><td className="p-4">{s.tp}</td><td className="p-4"><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300">{s.score}/100</span></td><td className="p-4">{s.tf}</td><td className="p-4"><Button soft>{trading ? `ABRIR ${s.side}` : 'Detalhes'}</Button></td></tr>)}</tbody></table></div>; }
function PlanGrid({ setPage }: { setPage: (p: Page) => void }) { return <section><Title title="Planos e Preços" subtitle="Pagamentos em Kwanza via PAGA: Multicaixa Express, QR Code, USSD, Visa/Mastercard e transferência bancária manual."/><div className="mt-6 grid gap-4 md:grid-cols-4">{plans.map((plan) => <div key={plan.name} className={`rounded-3xl border p-6 ${plan.featured ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/[0.04]'}`}><h3 className="text-xl font-bold">{plan.name}</h3><p className="mt-3 text-2xl font-black text-emerald-300">{plan.price}</p><ul className="my-5 space-y-2 text-sm text-slate-300">{plan.features.map(f => <li key={f}>✓ {f}</li>)}</ul><Button onClick={() => setPage('register')}>{plan.cta}</Button></div>)}</div></section>; }
function Autotrade() { return <section className="space-y-6"><Title title="Autotrading" subtitle="Configura pares, score mínimo default 70/100 e risco default 1%."/><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"><label className="flex items-center gap-3"><input type="checkbox" className="accent-emerald-400"/> Ativar autotrading por par</label><div className="mt-4 grid gap-4 md:grid-cols-3"><Kpi label="Estado" value="Pausado" accent="text-amber-300"/><Kpi label="Reason" value="Paper default" accent="text-slate-100"/><Kpi label="Ordens automáticas" value="0"/></div></div></section>; }
function History() { return <section className="space-y-6"><Title title="Histórico e Analytics" subtitle="Filtros por par, direção, resultado e data, com export CSV/PDF planeado."/><div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pnl} dataKey="value" nameKey="name" outerRadius={90}>{pnl.map((_, i) => <Cell key={i} fill={i ? '#fb7185' : '#34d399'} />)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><ResponsiveContainer width="100%" height={260}><BarChart data={[{pair:'BTC',pnl:740},{pair:'ETH',pnl:320},{pair:'SOL',pnl:-90}]}><XAxis dataKey="pair" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><Tooltip/><Bar dataKey="pnl" fill="#34d399"/></BarChart></ResponsiveContainer></div></div></section>; }
function Settings() { return <section className="space-y-6"><Title title="Definições e Binance" subtitle="API keys são encriptadas com AES-256-GCM, salt aleatória por utilizador e chave mestra obrigatória."/><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"><input placeholder="API Key" className="w-full rounded-xl border border-white/10 bg-slate-900 p-3"/><input placeholder="API Secret" type="password" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 p-3"/><select className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 p-3"><option>Testnet</option><option>Live</option></select><div className="mt-5"><Button>Conectar Binance</Button></div></div></section>; }
function Admin() { return <section className="space-y-6"><Title title="Admin Panel" subtitle="Utilizadores, receita, subscrições, logs e refresh de sinais."/><div className="grid gap-4 md:grid-cols-3"><Kpi label="MRR" value="0 Kz"/><Kpi label="Novos subscritores" value="0"/><Kpi label="Churn rate" value="0%"/></div></section>; }
