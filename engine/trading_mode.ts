/**
 * ===================================================================
 * TRADE AO — Trading Mode & Real Trading Guardrails (engine/trading_mode.ts)
 * FASE 19: Safe Feature Flag Configuration & Live Trading Protection
 * ===================================================================
 * Allowed Modes:
 *   - 'paper'   : Virtual execution & simulation (Default & safest)
 *   - 'testnet' : Official Binance Testnet sandbox execution
 *   - 'live'    : Real execution with real capital (Requires explicit activation)
 * 
 * DEFAULT: TRADING_MODE=paper
 * NEVER activate live trading automatically.
 * ===================================================================
 */

import fs from "fs";
import path from "path";

export type TradingMode = "paper" | "testnet" | "live";
export type UserLiveTradingStatus = "LIVE_DISABLED" | "LIVE_ENABLED";

export const ALLOWED_TRADING_MODES: TradingMode[] = ["paper", "testnet", "live"];
export const DEFAULT_TRADING_MODE: TradingMode = "paper";
export const DEFAULT_USER_LIVE_STATUS: UserLiveTradingStatus = "LIVE_DISABLED";

// FASE 21: Mandatory exact confirmation phrase for activating real autotrading
export const LIVE_CONFIRMATION_PHRASE = "LIVE TRADING ATIVADO";

// FASE 21: Official Whitelisted Spot Pairs
export const ALLOWED_SPOT_SYMBOLS: string[] = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "ADA/USDT",
  "DOGE/USDT",
  "AVAX/USDT",
  "DOT/USDT",
  "LINK/USDT",
  "NEAR/USDT",
  "MATIC/USDT",
  "SUI/USDT",
  "APT/USDT",
];

const CONFIG_FILE_PATH = path.join(process.cwd(), "storage", "trading_mode.json");
const USER_LIVE_STATUS_FILE = path.join(process.cwd(), "storage", "user_live_status.json");

// In-memory per-user live trading state
const USER_LIVE_STATE_MAP = new Map<string, UserLiveTradingStatus>();

function loadUserLiveStatesFromDisk(): Record<string, UserLiveTradingStatus> {
  try {
    if (fs.existsSync(USER_LIVE_STATUS_FILE)) {
      const raw = fs.readFileSync(USER_LIVE_STATUS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error loading user_live_status.json:", err);
  }
  return {};
}

function saveUserLiveStatesToDisk(states: Record<string, UserLiveTradingStatus>): void {
  try {
    const dir = path.dirname(USER_LIVE_STATUS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USER_LIVE_STATUS_FILE, JSON.stringify(states, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving user_live_status.json:", err);
  }
}

export function getUserLiveStatus(userId: string | number): UserLiveTradingStatus {
  const uid = String(userId);
  if (USER_LIVE_STATE_MAP.has(uid)) {
    return USER_LIVE_STATE_MAP.get(uid)!;
  }
  const disk = loadUserLiveStatesFromDisk();
  const status = disk[uid] || DEFAULT_USER_LIVE_STATUS;
  USER_LIVE_STATE_MAP.set(uid, status);
  return status;
}

export function setUserLiveStatus(
  userId: string | number,
  status: UserLiveTradingStatus,
  confirmationPhrase?: string
): { success: boolean; status: UserLiveTradingStatus; error?: string; message?: string } {
  const uid = String(userId);
  const targetStatus = status.toUpperCase().trim() as UserLiveTradingStatus;

  if (targetStatus !== "LIVE_ENABLED" && targetStatus !== "LIVE_DISABLED") {
    return {
      success: false,
      status: getUserLiveStatus(uid),
      error: `Estado inválido: '${status}'. Permitidos: LIVE_DISABLED, LIVE_ENABLED`,
    };
  }

  // FASE 21: Strict validation of explicit confirmation phrase
  if (targetStatus === "LIVE_ENABLED") {
    const cleanPhrase = String(confirmationPhrase || "").trim();
    if (cleanPhrase !== LIVE_CONFIRMATION_PHRASE) {
      return {
        success: false,
        status: getUserLiveStatus(uid),
        error: `⛔ Confirmação explícita rejeitada: É obrigatório digitar exatamente '${LIVE_CONFIRMATION_PHRASE}' para autorizar o autotrading real.`,
      };
    }
  }

  // Update in-memory map & disk persistence
  USER_LIVE_STATE_MAP.set(uid, targetStatus);
  const disk = loadUserLiveStatesFromDisk();
  disk[uid] = targetStatus;
  saveUserLiveStatesToDisk(disk);

  return {
    success: true,
    status: targetStatus,
    message: targetStatus === "LIVE_ENABLED"
      ? "🔴 LIVE TRADING ATIVADO: O usuário autorizou operações reais na Binance com suas próprias credenciais."
      : "🟢 LIVE TRADING DESATIVADO: Operações reais pausadas. Modo seguro ativo.",
  };
}

export function isUserLiveEnabled(userId: string | number): boolean {
  const globalLive = isLiveTradingEnabled();
  const userStatus = getUserLiveStatus(userId);
  return globalLive && userStatus === "LIVE_ENABLED";
}

export function isSymbolAllowed(symbol: string): boolean {
  if (!symbol) return false;
  const clean = symbol.trim().toUpperCase();
  // Check exact pair or normalized pair
  const standardPair = clean.includes("/") ? clean : `${clean.slice(0, -4)}/${clean.slice(-4)}`;
  const isWhitelisted = ALLOWED_SPOT_SYMBOLS.includes(standardPair) || ALLOWED_SPOT_SYMBOLS.includes(clean);
  const hasValidQuote = clean.endsWith("USDT") || standardPair.endsWith("/USDT");
  return Boolean(isWhitelisted && hasValidQuote);
}

export function getBinanceBaseUrl(mode?: TradingMode): string {
  const current = mode || getTradingMode();
  if (current === "live") {
    return "https://api.binance.com";
  }
  return "https://testnet.binance.vision";
}

function readRuntimeOverride(): TradingMode | null {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      const mode = String(parsed.trading_mode || "").toLowerCase().trim() as TradingMode;
      if (ALLOWED_TRADING_MODES.includes(mode)) {
        return mode;
      }
    }
  } catch (err) {
    console.error("Error reading trading_mode.json override:", err);
  }
  return null;
}

export function getTradingMode(): TradingMode {
  // 1. Runtime override from storage
  const runtime = readRuntimeOverride();
  if (runtime) return runtime;

  // 2. Environment variable TRADING_MODE
  const envMode = (process.env.TRADING_MODE || DEFAULT_TRADING_MODE).toLowerCase().trim() as TradingMode;
  if (ALLOWED_TRADING_MODES.includes(envMode)) {
    return envMode;
  }

  // 3. Safe fallback default: 'paper'
  return DEFAULT_TRADING_MODE;
}

export function setTradingMode(mode: string, updatedBy = "user"): { success: boolean; tradingMode: TradingMode; isLive: boolean; error?: string; message?: string } {
  const cleanMode = String(mode || "").toLowerCase().trim() as TradingMode;
  if (!ALLOWED_TRADING_MODES.includes(cleanMode)) {
    return {
      success: false,
      tradingMode: getTradingMode(),
      isLive: isLiveTradingEnabled(),
      error: `Modo de trading inválido: '${mode}'. Valores permitidos: ${ALLOWED_TRADING_MODES.join(", ")}`,
    };
  }

  try {
    const storageDir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const payload = {
      trading_mode: cleanMode,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
      is_live: cleanMode === "live",
    };

    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");

    return {
      success: true,
      tradingMode: cleanMode,
      isLive: cleanMode === "live",
      message: `Modo de trading atualizado com sucesso para '${cleanMode.toUpperCase()}'.`,
    };
  } catch (err: any) {
    return {
      success: false,
      tradingMode: getTradingMode(),
      isLive: isLiveTradingEnabled(),
      error: `Falha ao salvar configuração: ${err.message}`,
    };
  }
}

export function isLiveTradingEnabled(): boolean {
  return getTradingMode() === "live";
}

export const isLiveTradingAllowed = isLiveTradingEnabled;

export function isTestnetMode(): boolean {
  return getTradingMode() === "testnet";
}

export function isPaperMode(): boolean {
  return getTradingMode() === "paper";
}

export function assertLiveTradingAllowed(): void {
  const current = getTradingMode();
  if (current !== "live") {
    throw new Error(
      `⛔ SEGURANÇA BLOQUEADA: Tentativa de envio de ordem real com TRADING_MODE='${current}'. ` +
      `O trading real requer TRADING_MODE='live' configurado explicitamente.`
    );
  }
}

export function getTradingModeStatus() {
  const current = getTradingMode();
  return {
    tradingMode: current,
    isLive: current === "live",
    isTestnet: current === "testnet",
    isPaper: current === "paper",
    defaultMode: DEFAULT_TRADING_MODE,
    allowedModes: ALLOWED_TRADING_MODES,
    guardrails: {
      neverAutoActivateLive: true,
      defaultIsPaper: true,
      requiresExplicitLiveFlag: true,
      stopLossMandatory: true,
    },
  };
}
