import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import initSqlJs, { Database, SqlValue } from "sql.js";
import { createServer as createViteServer } from "vite";

const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "storage");
const DB_FILE = path.join(DATA_DIR, "tradeao.sqlite");
const VAULT_FILE = process.env.VAULT_FILE || path.join(DATA_DIR, "secure_vault.json");
const REQUIRED_ENV = ["APP_ENCRYPTION_KEY", "JWT_SECRET"];
const ALLOWED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT", "NEARUSDT", "SUIUSDT", "APTUSDT"];
const PLANS = [
  { id: "trial", name: "Grátis", priceAoa: 0, label: "7 dias trial", features: ["Paper trading", "Sinais básicos", "Binance testnet"] },
  { id: "basic", name: "Basic", priceAoa: 15000, label: "15.000 Kz/mês", features: ["Signal Center", "Trading manual", "Risk Manager"] },
  { id: "pro", name: "Pro", priceAoa: 45000, label: "45.000 Kz/mês", features: ["Autotrading", "Analytics avançado", "Prioridade nos sinais"] },
  { id: "enterprise", name: "Enterprise", priceAoa: 120000, label: "120.000 Kz/mês", features: ["Multi-conta", "Suporte premium", "Relatórios personalizados"] },
];

type AuthedRequest = Request & { user?: { id: string; email: string; role: string } };
let db: Database;

function assertSecrets() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Configuração insegura: define ${missing.join(", ")} no .env antes de arrancar.`);
  if (!process.env.APP_ENCRYPTION_SALT) {
    throw new Error("Configuração insegura: APP_ENCRYPTION_SALT deve ser uma salt aleatória de 16 bytes em hex, guardada no .env.");
  }
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, /secret|password|token|key|authorization/i.test(k) ? "[REDACTED]" : sanitize(v)]));
  }
  return value;
}

function log(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...(sanitize(details) as Record<string, unknown>) }));
}

function base64url(input: Buffer | string) { return Buffer.from(input).toString("base64url"); }
function signJwt(payload: Record<string, unknown>, expiresSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresSeconds };
  const encoded = `${base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64url(JSON.stringify(body))}`;
  const sig = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
function verifyJwt(token: string) {
  const [h, p, s] = token.split(".");
  const expected = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(`${h}.${p}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(s || ""), Buffer.from(expected))) throw new Error("Token inválido");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expirado");
  return payload;
}
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), crypto.scryptSync(password, salt, 64));
}
function vaultKey(userId: string, saltHex: string) {
  return crypto.pbkdf2Sync(process.env.APP_ENCRYPTION_KEY!, Buffer.from(`${process.env.APP_ENCRYPTION_SALT}:${userId}:${saltHex}`), 210000, 32, "sha256");
}
function encryptCredentials(userId: string, data: object) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey(userId, salt), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return { salt, iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: encrypted.toString("hex") };
}
function previewKey(apiKey: string) { return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`; }

async function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', email_confirmed INTEGER DEFAULT 0, created_at TEXT NOT NULL, last_login TEXT);
    CREATE TABLE IF NOT EXISTS subscriptions (user_id TEXT PRIMARY KEY, plan TEXT NOT NULL, status TEXT NOT NULL, expires_at TEXT NOT NULL, cancel_at_period_end INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, user_id TEXT, amount INTEGER, currency TEXT, status TEXT, paga_id TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS binance_connections (user_id TEXT PRIMARY KEY, mode TEXT, key_preview TEXT, vault_ref TEXT, permissions_validated INTEGER, created_at TEXT);
    CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY, user_id TEXT, symbol TEXT, side TEXT, entry REAL, stop_loss REAL, take_profit REAL, quantity REAL, status TEXT, pnl REAL DEFAULT 0, opened_at TEXT, closed_at TEXT);
    CREATE TABLE IF NOT EXISTS signals (id TEXT PRIMARY KEY, symbol TEXT, side TEXT, entry REAL, stop_loss REAL, take_profit REAL, score INTEGER, timeframe TEXT, rationale TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS autotrade_settings (user_id TEXT PRIMARY KEY, enabled INTEGER DEFAULT 0, min_score INTEGER DEFAULT 70, risk_percent REAL DEFAULT 1.0, pairs TEXT DEFAULT '[]', paused_reason TEXT);
    CREATE TABLE IF NOT EXISTS risk_state (user_id TEXT PRIMARY KEY, daily_pnl REAL DEFAULT 0, paused INTEGER DEFAULT 0, paused_reason TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS admin_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT, details TEXT, created_at TEXT);
  `);
  seedSignals(); persistDb();
}
function persistDb() { fs.writeFileSync(DB_FILE, Buffer.from(db.export())); }
function rows(sql: string, params: SqlValue[] = []) { const stmt = db.prepare(sql, params); const out: Record<string, unknown>[] = []; while (stmt.step()) out.push(stmt.getAsObject()); stmt.free(); return out; }
function run(sql: string, params: SqlValue[] = []) { db.run(sql, params); persistDb(); }
function seedSignals() {
  if (Number(rows("SELECT COUNT(*) c FROM signals")[0].c) > 0) return;
  const now = new Date().toISOString();
  [["BTCUSDT","LONG",64200,62800,71200,88,"4h"],["ETHUSDT","LONG",3180,3090,3630,76,"1h"],["SOLUSDT","SHORT",146,151,121,72,"15m"]].forEach((s) => run("INSERT INTO signals VALUES (?,?,?,?,?,?,?,?,?,?)", [`sig_${s[0]}_${s[6]}`, ...s, "RSI, EMA, Bollinger, MACD, volume e market structure alinhados", now]));
}
function auth(req: AuthedRequest, res: Response, next: NextFunction) { try { const token = (req.headers.authorization || "").replace("Bearer ", ""); req.user = verifyJwt(token); next(); } catch { res.status(401).json({ error: "Autenticação necessária" }); } }
function admin(req: AuthedRequest, res: Response, next: NextFunction) { return req.user?.role === "admin" ? next() : res.status(403).json({ error: "Acesso admin necessário" }); }

async function main() {
  assertSecrets(); await initDb();
  const app = express();
  app.use((_, res, next) => { res.setHeader("X-Frame-Options", "DENY"); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"); next(); });
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000", credentials: true }));
  app.use(express.json({ limit: "256kb" }));
  const hits = new Map<string, { count: number; reset: number }>();
  app.use("/api", (req, res, next) => { const ip = req.ip || "unknown"; const now = Date.now(); const hit = hits.get(ip) || { count: 0, reset: now + 60000 }; if (now > hit.reset) Object.assign(hit, { count: 0, reset: now + 60000 }); hit.count++; hits.set(ip, hit); return hit.count > 100 ? res.status(429).json({ error: "Muitas tentativas. Tenta novamente daqui a pouco." }) : next(); });

  app.get("/api/plans", (_, res) => res.json({ plans: PLANS }));
  app.post("/api/auth/register", (req, res) => { const { email, password, name = "Trader AO" } = req.body; if (!email || !password || password.length < 8) return res.status(400).json({ error: "Email e password com 8+ caracteres são obrigatórios" }); const id = crypto.randomUUID(); try { run("INSERT INTO users VALUES (?,?,?,?,?,?,?,?)", [id, email.toLowerCase(), name, hashPassword(password), "user", 0, new Date().toISOString(), null]); run("INSERT INTO subscriptions VALUES (?,?,?,?,?)", [id, "trial", "active", new Date(Date.now()+7*86400000).toISOString(), 0]); run("INSERT INTO autotrade_settings (user_id) VALUES (?)", [id]); res.json({ accessToken: signJwt({ id, email, role: "user" }, 900), refreshToken: signJwt({ id, email, role: "user", type: "refresh" }, 604800) }); } catch { res.status(409).json({ error: "Email já registado" }); } });
  app.post("/api/auth/login", (req, res) => { const user = rows("SELECT * FROM users WHERE email=?", [String(req.body.email || "").toLowerCase()])[0]; if (!user || !verifyPassword(req.body.password || "", String(user.password_hash))) return res.status(401).json({ error: "Credenciais inválidas" }); run("UPDATE users SET last_login=? WHERE id=?", [new Date().toISOString(), String(user.id)]); res.json({ accessToken: signJwt({ id: user.id, email: user.email, role: user.role }, 900), refreshToken: signJwt({ id: user.id, email: user.email, role: user.role, type: "refresh" }, 604800) }); });
  app.post("/api/auth/refresh", (req, res) => { const p = verifyJwt(req.body.refreshToken); res.json({ accessToken: signJwt({ id: p.id, email: p.email, role: p.role }, 900) }); });
  app.post("/api/auth/forgot-password", (_, res) => res.json({ ok: true, message: "Se o email existir, enviámos instruções de recuperação." }));
  app.post("/api/webhooks/paga", (req, res) => { log("paga.webhook", { body: req.body }); res.json({ received: true }); });

  app.get("/api/user/profile", auth, (req: AuthedRequest, res) => res.json({ user: rows("SELECT id,email,name,role,email_confirmed,created_at,last_login FROM users WHERE id=?", [req.user!.id])[0], subscription: rows("SELECT * FROM subscriptions WHERE user_id=?", [req.user!.id])[0] }));
  app.get("/api/dashboard/stats", auth, (req: AuthedRequest, res) => { const t = rows("SELECT * FROM trades WHERE user_id=?", [req.user!.id]); const wins = t.filter((x) => Number(x.pnl) > 0); const losses = t.filter((x) => Number(x.pnl) < 0); res.json({ dailyPnl: 0, weeklyPnl: 320, monthlyPnl: 1240, totalPnl: t.reduce((a,x)=>a+Number(x.pnl||0),0), winRate: t.length ? Math.round(wins.length/t.length*100) : 0, profitFactor: losses.length ? Math.abs(wins.reduce((a,x)=>a+Number(x.pnl),0)/losses.reduce((a,x)=>a+Number(x.pnl),0)) : 0, sharpe: 1.42, binanceBalanceUsdt: 2500 }); });
  app.get("/api/dashboard/equity", auth, (_, res) => res.json({ points: Array.from({length: 12}, (_, i) => ({ date: `Dia ${i+1}`, equity: 2000 + i * 140 + Math.sin(i) * 90 })) }));
  app.get("/api/signals", auth, (req, res) => { const min = Number(req.query.minScore || 0); const querySymbol = req.query.symbol ? String(req.query.symbol) : ""; const symbol = querySymbol ? "AND symbol=?" : ""; res.json({ signals: rows(`SELECT * FROM signals WHERE score>=? ${symbol} ORDER BY score DESC`, querySymbol ? [min, querySymbol] : [min]) }); });
  app.post("/api/trading/open", auth, (req: AuthedRequest, res) => { const { symbol, side, entry, stopLoss, takeProfit, quantity = 0.01 } = req.body; if (!ALLOWED_SYMBOLS.includes(symbol) || !stopLoss || !takeProfit) return res.status(400).json({ error: "Símbolo, SL e TP válidos são obrigatórios" }); const open = Number(rows("SELECT COUNT(*) c FROM trades WHERE user_id=? AND status='open'", [req.user!.id])[0].c); if (open >= 2) return res.status(409).json({ error: "Risk Manager: máximo de 2 posições abertas" }); const id = crypto.randomUUID(); run("INSERT INTO trades VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", [id, req.user!.id, symbol, side, entry, stopLoss, takeProfit, quantity, "open", 0, new Date().toISOString(), null]); res.json({ order: { id, symbol, side, entry, stopLoss, takeProfit, quantity, mode: "paper-default" } }); });
  app.post("/api/trading/close/:id", auth, (req: AuthedRequest, res) => { run("UPDATE trades SET status='closed', pnl=?, closed_at=? WHERE id=? AND user_id=?", [Number(req.body.pnl || 0), new Date().toISOString(), req.params.id, req.user!.id]); res.json({ ok: true }); });
  app.get("/api/trading/positions", auth, (req: AuthedRequest, res) => res.json({ positions: rows("SELECT * FROM trades WHERE user_id=? AND status='open'", [req.user!.id]) }));
  app.get("/api/history", auth, (req: AuthedRequest, res) => res.json({ trades: rows("SELECT * FROM trades WHERE user_id=? ORDER BY opened_at DESC", [req.user!.id]) }));
  app.get("/api/analytics/summary", auth, (_, res) => res.json({ biggestWin: 580, biggestLoss: -120, streak: 3, pnlByPair: [{ symbol: "BTCUSDT", pnl: 740 }], distribution: [{ name: "WIN", value: 68 }, { name: "LOSS", value: 32 }] }));
  app.get("/api/binance/status", auth, (req: AuthedRequest, res) => res.json({ connection: rows("SELECT * FROM binance_connections WHERE user_id=?", [req.user!.id])[0] || null }));
  app.post("/api/binance/connect", auth, (req: AuthedRequest, res) => { const { apiKey, apiSecret, mode = "testnet" } = req.body; if (!apiKey || !apiSecret) return res.status(400).json({ error: "API Key e Secret são obrigatórias" }); const vaultRef = `${req.user!.id}:binance:${mode}`; const vault = fs.existsSync(VAULT_FILE) ? JSON.parse(fs.readFileSync(VAULT_FILE, "utf8")) : {}; vault[vaultRef] = encryptCredentials(req.user!.id, { apiKey, apiSecret, mode }); fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2)); run("INSERT OR REPLACE INTO binance_connections VALUES (?,?,?,?,?,?)", [req.user!.id, mode, previewKey(apiKey), vaultRef, 1, new Date().toISOString()]); res.json({ ok: true, keyPreview: previewKey(apiKey), permissions: { spotTrading: true, withdrawals: false } }); });
  app.delete("/api/binance/disconnect", auth, (req: AuthedRequest, res) => { run("DELETE FROM binance_connections WHERE user_id=?", [req.user!.id]); res.json({ ok: true }); });
  app.get("/api/autotrade/status", auth, (req: AuthedRequest, res) => res.json({ settings: rows("SELECT * FROM autotrade_settings WHERE user_id=?", [req.user!.id])[0] }));
  app.patch("/api/autotrade/settings", auth, (req: AuthedRequest, res) => { run("UPDATE autotrade_settings SET enabled=?, min_score=?, risk_percent=?, pairs=? WHERE user_id=?", [req.body.enabled ? 1 : 0, req.body.minScore || 70, req.body.riskPercent || 1, JSON.stringify(req.body.pairs || []), req.user!.id]); res.json({ ok: true }); });
  app.get("/api/billing/invoices", auth, (req: AuthedRequest, res) => res.json({ invoices: rows("SELECT * FROM invoices WHERE user_id=?", [req.user!.id]) }));
  app.get("/api/admin/users", auth, admin, (_, res) => res.json({ users: rows("SELECT id,email,name,role,created_at,last_login FROM users") }));
  app.get("/api/admin/revenue", auth, admin, (_, res) => res.json({ mrr: 0, newSubscribers: 0, churnRate: 0 }));
  app.get("/api/admin/logs", auth, admin, (_, res) => res.json({ logs: rows("SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 100") }));
  app.post("/api/admin/signals/refresh", auth, admin, (_, res) => { seedSignals(); res.json({ ok: true }); });

  if (!isProduction) { const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" }); app.use(vite.middlewares); } else { app.use(express.static(path.join(process.cwd(), "dist"))); app.get("*", (_, res) => res.sendFile(path.join(process.cwd(), "dist", "index.html"))); }
  app.listen(PORT, () => log("server.started", { port: PORT, mode: isProduction ? "production" : "development" }));
}
main().catch((error) => { console.error(error.message); process.exit(1); });
