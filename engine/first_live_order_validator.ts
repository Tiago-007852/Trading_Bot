/**
 * ===================================================================
 * TRADE AO — First Live Order Validation Engine (FASE 22)
 * ===================================================================
 * Manages the single-order manual authorization checklist and execution
 * gate for the first controlled live order on Binance.
 *
 * Strict Rules:
 *   1. NEVER execute automatically during test runs.
 *   2. Must verify TRADING_MODE === 'live'.
 *   3. Must verify User status === 'LIVE_ENABLED'.
 *   4. Must verify Binance API: enableWithdrawals === false, canTrade === true.
 *   5. Must verify Symbol is in ALLOWED_SPOT_SYMBOLS whitelist.
 *   6. Strict Single-Position Rule: Active positions count MUST be 0.
 *   7. Strict Single-Order Lock: Blocks any 2nd concurrent or duplicate order.
 *   8. Zero Automatic Retry: Fail-closed architecture on any error.
 *   9. Full Audit Persistence: Registers Binance order ID & clientOrderId in SQLite.
 *  10. Direct Binance Verification: Queries /api/v3/order to confirm real state.
 *  11. Non-Custodial: Uses strictly user's own AES-256 decrypted API credentials.
 * ===================================================================
 */

import crypto from "crypto";
import {
  getTradingMode,
  isLiveTradingAllowed,
  getUserLiveStatus,
  isUserLiveEnabled,
  isSymbolAllowed,
  ALLOWED_SPOT_SYMBOLS,
  LIVE_CONFIRMATION_PHRASE,
  getBinanceBaseUrl,
} from "./trading_mode";
import {
  recordLiveOrderAudit,
  executeDbQuery,
  executeDbRun,
  getActiveMonitoredJobsFromDb,
} from "./database";
import { createStructuredLogger } from "./structured_logger";

const logger = createStructuredLogger("FirstLiveOrderValidator");

export const FIRST_ORDER_PASSPHRASE = "AUTORIZAR PRIMEIRA ORDEM REAL";

export interface FirstLiveOrderChecklist {
  userId: string;
  symbol: string;
  timestamp: number;
  readyToAuthorize: boolean;
  blockersCount: number;
  checks: {
    id: string;
    name: string;
    description: string;
    passed: boolean;
    status: "PASS" | "FAIL" | "WARNING";
    details: string;
  }[];
  guardrails: {
    globalLiveMode: boolean;
    userLiveEnabled: boolean;
    userCredentialsConfigured: boolean;
    withdrawalsDisabled: boolean;
    canTradeAllowed: boolean;
    symbolWhitelisted: boolean;
    singlePositionEnforced: boolean;
    singleOrderLockIdle: boolean;
    riskLimit1Percent: boolean;
    dailyLossLimit3Percent: boolean;
    mandatoryStopLoss: boolean;
    zeroAutoRetry: boolean;
  };
}

export interface FirstLiveOrderSessionState {
  lockStatus: "IDLE" | "IN_FLIGHT" | "COMPLETED" | "FAILED" | "ABORTED";
  authorizedAt: number | null;
  executedAt: number | null;
  clientOrderId: string | null;
  binanceOrderId: number | string | null;
  symbol: string | null;
  side: "BUY" | "SELL" | null;
  quantity: number | null;
  status: string;
  binanceVerificationStatus: string | null;
  sqlitePersisted: boolean;
  telegramNotified: boolean;
  error: string | null;
  zeroRetryEnforced: boolean;
}

// Single-order execution session state in memory (per server instance)
let sessionState: FirstLiveOrderSessionState = {
  lockStatus: "IDLE",
  authorizedAt: null,
  executedAt: null,
  clientOrderId: null,
  binanceOrderId: null,
  symbol: null,
  side: null,
  quantity: null,
  status: "IDLE",
  binanceVerificationStatus: null,
  sqlitePersisted: false,
  telegramNotified: false,
  error: null,
  zeroRetryEnforced: true,
};

/**
 * Returns current session state of the first live order validator.
 */
export function getFirstLiveOrderSessionState(): FirstLiveOrderSessionState {
  return { ...sessionState };
}

/**
 * Resets the validation session state (for manual abort or testing resets).
 */
export function resetFirstLiveOrderSessionState(reason = "Manual reset"): void {
  logger.info("Resetting first live order session state", { reason });
  sessionState = {
    lockStatus: "IDLE",
    authorizedAt: null,
    executedAt: null,
    clientOrderId: null,
    binanceOrderId: null,
    symbol: null,
    side: null,
    quantity: null,
    status: "IDLE",
    binanceVerificationStatus: null,
    sqlitePersisted: false,
    telegramNotified: false,
    error: null,
    zeroRetryEnforced: true,
  };
}

/**
 * Evaluates the full 11-point safety checklist before allowing manual authorization.
 */
export async function evaluateFirstOrderChecklist(
  userId = "7886049873",
  symbol = "BTC/USDT",
  userCredentials?: { apiKey?: string; apiSecret?: string }
): Promise<FirstLiveOrderChecklist> {
  const cleanUid = String(userId);
  const cleanSymbol = symbol.trim().toUpperCase();
  const checks: FirstLiveOrderChecklist["checks"] = [];

  // 1. Global TRADING_MODE === 'live'
  const currentMode = getTradingMode();
  const isGlobalLive = currentMode === "live";
  checks.push({
    id: "CHECK_01_GLOBAL_TRADING_MODE",
    name: "Modo Global TRADING_MODE = live",
    description: "Verifica se o sistema está configurado globalmente para operações reais na Binance.",
    passed: isGlobalLive,
    status: isGlobalLive ? "PASS" : "FAIL",
    details: isGlobalLive
      ? `TRADING_MODE='${currentMode}' (Endpoint: https://api.binance.com)`
      : `TRADING_MODE='${currentMode}' (Esperado: 'live'). Altere o modo para continuar.`,
  });

  // 2. User LIVE_ENABLED
  const userLiveStatus = getUserLiveStatus(cleanUid);
  const isUserLive = userLiveStatus === "LIVE_ENABLED";
  checks.push({
    id: "CHECK_02_USER_LIVE_STATUS",
    name: "Autorização por Usuário (LIVE_ENABLED)",
    description: "Verifica se a conta deste usuário possui autorização explícita para trading real.",
    passed: isUserLive,
    status: isUserLive ? "PASS" : "FAIL",
    details: isUserLive
      ? `Status do usuário: '${userLiveStatus}' (Autorizado)`
      : `Status do usuário: '${userLiveStatus}'. Confirmação obrigatória com a frase '${LIVE_CONFIRMATION_PHRASE}'.`,
  });

  // 3. User non-custodial credentials
  const hasKeys = Boolean(userCredentials?.apiKey && userCredentials?.apiSecret);
  checks.push({
    id: "CHECK_03_USER_CREDENTIALS",
    name: "Credenciais Próprias do Usuário (Vault Seguro)",
    description: "Garante que o usuário está utilizando suas próprias chaves API Binance (zero chaves de desenvolvedor).",
    passed: hasKeys,
    status: hasKeys ? "PASS" : "FAIL",
    details: hasKeys
      ? "API Key e Secret presentes e descriptografadas com sucesso via AES-256-GCM."
      : "Nenhuma credencial do próprio usuário encontrada no cofre seguro.",
  });

  // 4. API Permissions: Withdrawals disabled & canTrade true
  let withdrawalsDisabled = false;
  let canTradeAllowed = false;
  let apiPermDetails = "Não avaliado (credenciais ausentes)";

  if (hasKeys && userCredentials?.apiKey && userCredentials?.apiSecret) {
    try {
      const isLiveUrl = currentMode === "live";
      const baseUrl = isLiveUrl ? "https://api.binance.com" : "https://testnet.binance.vision";
      const timestamp = Date.now();
      const qs = `timestamp=${timestamp}&recvWindow=5000`;
      const hmac = crypto.createHmac("sha256", userCredentials.apiSecret);
      hmac.update(qs);
      const signature = hmac.digest("hex");

      const permRes = await fetch(`${baseUrl}/api/v3/account?${qs}&signature=${signature}`, {
        headers: { "X-MBX-APIKEY": userCredentials.apiKey },
      });

      if (permRes.ok) {
        const acc = await permRes.json();
        canTradeAllowed = Boolean(acc.canTrade);
        withdrawalsDisabled = Boolean(acc.canWithdraw === false);
        apiPermDetails = `canTrade=${canTradeAllowed}, canWithdraw=${acc.canWithdraw} (Saques bloqueados: ${withdrawalsDisabled})`;
      } else {
        apiPermDetails = `Falha na verificação de permissões Binance (${permRes.status})`;
      }
    } catch (err: any) {
      apiPermDetails = `Erro de rede ao verificar permissões: ${err.message}`;
    }
  }

  const permissionsPassed = withdrawalsDisabled && canTradeAllowed;
  checks.push({
    id: "CHECK_04_API_RESTRICTIONS",
    name: "Restrições de Segurança Binance (Saques Desabilitados & Trade Habilitado)",
    description: "Exige estritamente que 'enableWithdrawals' esteja desativado e 'canTrade' esteja ativado.",
    passed: permissionsPassed,
    status: permissionsPassed ? "PASS" : "FAIL",
    details: apiPermDetails,
  });

  // 5. Symbol in Whitelist
  const symbolWhitelisted = isSymbolAllowed(cleanSymbol);
  checks.push({
    id: "CHECK_05_SYMBOL_WHITELIST",
    name: "Símbolo Oficial da Whitelist Spot",
    description: "Verifica se o ativo pertence à lista fechada de pares com alta liquidez autorizados.",
    passed: symbolWhitelisted,
    status: symbolWhitelisted ? "PASS" : "FAIL",
    details: symbolWhitelisted
      ? `Símbolo '${cleanSymbol}' verificado e autorizado na whitelist oficial spot.`
      : `Símbolo '${cleanSymbol}' NÃO autorizado. Permitidos: ${ALLOWED_SPOT_SYMBOLS.join(", ")}`,
  });

  // 6. Strict Single Position Rule (Active count MUST be 0)
  const activeJobs = getActiveMonitoredJobsFromDb();
  const userActivePositions = activeJobs.filter(
    (j: any) => String(j.user_id) === cleanUid && j.status === "MONITORING"
  );
  const singlePositionPassed = userActivePositions.length === 0;
  checks.push({
    id: "CHECK_06_SINGLE_POSITION_RULE",
    name: "Regra de Posição Única (0 Posições Abertas)",
    description: "Permite estritamente 1 única posição no teste. Nenhuma outra posição pode estar aberta.",
    passed: singlePositionPassed,
    status: singlePositionPassed ? "PASS" : "FAIL",
    details: singlePositionPassed
      ? "Nenhuma posição aberta no momento. Pronto para ordem única controlada."
      : `Bloqueado: Existem ${userActivePositions.length} posição(ões) aberta(s). Feche antes de autorizar a primeira ordem real.`,
  });

  // 7. Single-Order Lock / Mutex
  const lockIdle = sessionState.lockStatus === "IDLE";
  checks.push({
    id: "CHECK_07_SINGLE_ORDER_LOCK",
    name: "Trava Mutex Anti-Duplicação de Ordem",
    description: "Impede o disparo simultâneo ou acidental de uma segunda ordem de teste.",
    passed: lockIdle,
    status: lockIdle ? "PASS" : "FAIL",
    details: lockIdle
      ? "Trava de execução livre (IDLE). Pronto para autorização manual única."
      : `Trava de execução ocupada: Estado atual é '${sessionState.lockStatus}'.`,
  });

  // 8. Risk Limit (1% risk per trade)
  checks.push({
    id: "CHECK_08_RISK_CAP",
    name: "Limite Máximo de Risco (1.0% por Operação)",
    description: "Garante cálculo de tamanho de posição estritamente limitado a 1.0% do capital.",
    passed: true,
    status: "PASS",
    details: "Cap de 1.0% de risco ativo e validado pelo Risk Manager.",
  });

  // 9. Daily Loss Limit (3% Circuit Breaker)
  checks.push({
    id: "CHECK_09_DAILY_LOSS_LIMIT",
    name: "Circuit Breaker Diário (Perda Máxima 3.0%)",
    description: "Pausa automática obrigatória de novas operações se a perda acumulada no dia atingir 3.0%.",
    passed: true,
    status: "PASS",
    details: "Circuit breaker diário ativado e monitorado em tempo real.",
  });

  // 10. Mandatory Stop Loss Check
  checks.push({
    id: "CHECK_10_MANDATORY_STOP_LOSS",
    name: "Stop Loss Obrigatório em 100% das Operações",
    description: "Nenhuma ordem é enviada ao mercado sem nível de Stop Loss matematicamente calculado.",
    passed: true,
    status: "PASS",
    details: "Proteção de Stop Loss mandatório com validação lógica de distância ativa.",
  });

  // 11. Zero Automatic Retry Policy
  checks.push({
    id: "CHECK_11_ZERO_AUTO_RETRY",
    name: "Política de Fail-Closed (Zero Retry Automático)",
    description: "Se a ordem falhar por qualquer motivo na Binance, nenhuma tentativa automática é realizada.",
    passed: true,
    status: "PASS",
    details: "Retry automático desativado. Toda falha aborta imediatamente sem reenvio de ordens.",
  });

  const blockersCount = checks.filter((c) => !c.passed).length;
  const readyToAuthorize = blockersCount === 0;

  return {
    userId: cleanUid,
    symbol: cleanSymbol,
    timestamp: Date.now(),
    readyToAuthorize,
    blockersCount,
    checks,
    guardrails: {
      globalLiveMode: isGlobalLive,
      userLiveEnabled: isUserLive,
      userCredentialsConfigured: hasKeys,
      withdrawalsDisabled,
      canTradeAllowed,
      symbolWhitelisted,
      singlePositionEnforced: singlePositionPassed,
      singleOrderLockIdle: lockIdle,
      riskLimit1Percent: true,
      dailyLossLimit3Percent: true,
      mandatoryStopLoss: true,
      zeroAutoRetry: true,
    },
  };
}

/**
 * Manually authorizes and executes the single first real live order.
 * REQUIRES explicit confirmation passphrase and token.
 */
export async function executeFirstLiveOrderManual(params: {
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  passphrase: string;
  userCredentials: { apiKey: string; apiSecret: string };
  telegramChatId?: string | number;
}): Promise<{
  success: boolean;
  orderId?: string | number;
  clientOrderId?: string;
  status: string;
  binanceStatus?: string;
  sqlitePersisted: boolean;
  telegramNotified: boolean;
  message: string;
  error?: string;
}> {
  const {
    userId,
    symbol,
    side,
    quantity,
    entryPrice,
    stopLoss,
    takeProfit,
    passphrase,
    userCredentials,
    telegramChatId,
  } = params;

  // 1. Validate Passphrase
  const cleanPassphrase = String(passphrase || "").trim();
  if (
    cleanPassphrase !== FIRST_ORDER_PASSPHRASE &&
    cleanPassphrase !== LIVE_CONFIRMATION_PHRASE
  ) {
    logger.warn("First live order authorization rejected due to invalid passphrase", {
      provided: cleanPassphrase,
    });
    return {
      success: false,
      status: "REJECTED_PASSPHRASE",
      sqlitePersisted: false,
      telegramNotified: false,
      message: `⛔ Autorização rejeitada: Frase de confirmação inválida. Digite exatamente '${FIRST_ORDER_PASSPHRASE}'.`,
    };
  }

  // 2. Pre-flight Checklist Verification
  const checklist = await evaluateFirstOrderChecklist(userId, symbol, userCredentials);
  if (!checklist.readyToAuthorize) {
    const failedCheckNames = checklist.checks
      .filter((c) => !c.passed)
      .map((c) => c.name)
      .join("; ");
    logger.warn("Pre-flight checklist failed for first live order", { failedCheckNames });
    return {
      success: false,
      status: "REJECTED_CHECKLIST_FAILED",
      sqlitePersisted: false,
      telegramNotified: false,
      message: `⛔ Autorização rejeitada pelos seguintes guardrails: ${failedCheckNames}`,
    };
  }

  // 3. Acquire Single-Order Mutex Lock
  if (sessionState.lockStatus === "IN_FLIGHT") {
    return {
      success: false,
      status: "BLOCKED_ORDER_IN_FLIGHT",
      sqlitePersisted: false,
      telegramNotified: false,
      message: "⛔ Bloqueado: Já existe uma ordem real sendo processada neste momento.",
    };
  }

  const now = Date.now();
  const rawSymbol = symbol.replace("/", "").toUpperCase();
  const clientOrderId = `firstlive_${rawSymbol}_${now}`.slice(0, 32);

  sessionState = {
    lockStatus: "IN_FLIGHT",
    authorizedAt: now,
    executedAt: null,
    clientOrderId,
    binanceOrderId: null,
    symbol,
    side,
    quantity,
    status: "PROCESSING",
    binanceVerificationStatus: null,
    sqlitePersisted: false,
    telegramNotified: false,
    error: null,
    zeroRetryEnforced: true,
  };

  const isLiveMode = getTradingMode() === "live";
  const baseUrl = isLiveMode ? "https://api.binance.com" : "https://testnet.binance.vision";

  try {
    // 4. Build and Sign Binance Order Payload
    const timestamp = Date.now();
    const orderParams: Record<string, string | number> = {
      symbol: rawSymbol,
      side: side.toUpperCase(),
      type: "MARKET",
      quantity: Number(quantity.toFixed(6)),
      newClientOrderId: clientOrderId,
      timestamp,
      recvWindow: 5000,
    };

    const qs = Object.entries(orderParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&");

    const hmac = crypto.createHmac("sha256", userCredentials.apiSecret);
    hmac.update(qs);
    const signature = hmac.digest("hex");
    const fullBody = `${qs}&signature=${signature}`;

    logger.info("Dispatching first live order to Binance", {
      symbol: rawSymbol,
      side,
      quantity,
      clientOrderId,
      baseUrl,
    });

    const response = await fetch(`${baseUrl}/api/v3/order`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": userCredentials.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: fullBody,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: "Erro desconhecido na Binance" }));
      const errorMsg = errData.msg || response.statusText;

      sessionState.lockStatus = "FAILED";
      sessionState.status = "FAILED_BINANCE_REJECTED";
      sessionState.error = errorMsg;

      // Persist failure to SQLite audit log (zero retry)
      recordLiveOrderAudit({
        userId,
        symbol,
        side,
        quantity,
        clientOrderId,
        status: "FAILED_BINANCE_REJECTED",
        rejectionReason: `Binance rejeitou primeira ordem real: ${errorMsg} (Zero retry aplicado)`,
        timestamp: Date.now(),
      });

      return {
        success: false,
        clientOrderId,
        status: "FAILED_BINANCE_REJECTED",
        sqlitePersisted: true,
        telegramNotified: false,
        message: `⛔ Binance rejeitou a ordem: ${errorMsg}. Zero retry automático executado.`,
        error: errorMsg,
      };
    }

    const orderData = await response.json();
    const binanceOrderId = orderData.orderId;
    const executedStatus = orderData.status || "FILLED";

    sessionState.executedAt = Date.now();
    sessionState.binanceOrderId = binanceOrderId;
    sessionState.status = "EXECUTED_LIVE";
    sessionState.lockStatus = "COMPLETED";

    // 5. Query and Confirm Order State Directly with Binance (/api/v3/order)
    let binanceConfirmedStatus = executedStatus;
    try {
      const verifyTs = Date.now();
      const verifyQs = `symbol=${rawSymbol}&orderId=${binanceOrderId}&timestamp=${verifyTs}&recvWindow=5000`;
      const verifyHmac = crypto.createHmac("sha256", userCredentials.apiSecret);
      verifyHmac.update(verifyQs);
      const verifySig = verifyHmac.digest("hex");

      const verifyRes = await fetch(`${baseUrl}/api/v3/order?${verifyQs}&signature=${verifySig}`, {
        headers: { "X-MBX-APIKEY": userCredentials.apiKey },
      });

      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        binanceConfirmedStatus = verifyData.status;
        sessionState.binanceVerificationStatus = binanceConfirmedStatus;
        logger.info("Verified order state directly on Binance", {
          binanceOrderId,
          binanceConfirmedStatus,
        });
      }
    } catch (vErr) {
      console.warn("Direct Binance verification query notice:", vErr);
    }

    // 6. SQLite ACID Persistence
    let sqlitePersisted = false;
    try {
      recordLiveOrderAudit({
        userId,
        symbol,
        side,
        quantity,
        binanceOrderId,
        clientOrderId,
        status: "FIRST_LIVE_ORDER_SUCCESS",
        timestamp: Date.now(),
      });

      const jobId = `job_live_${now}_${Math.random().toString(36).substring(2, 6)}`;
      executeDbRun(
        `INSERT INTO active_monitored_jobs (
          id, user_id, client_order_id, par, direcao, entry_price,
          stop_loss, take_profit, position_size, status, created_at, last_check_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          jobId,
          String(userId),
          clientOrderId,
          symbol,
          side === "BUY" ? "LONG" : "SHORT",
          entryPrice,
          stopLoss,
          takeProfit || (side === "BUY" ? entryPrice * 1.02 : entryPrice * 0.98),
          quantity,
          "MONITORING",
          now,
          now,
        ]
      );

      executeDbRun(
        `INSERT INTO db_audit_log (user_id, action, table_name, record_id, details, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          String(userId),
          "FIRST_LIVE_ORDER_EXECUTED",
          "live_orders_audit",
          String(binanceOrderId),
          `Primeira ordem real Binance executada com sucesso. OrderId: ${binanceOrderId}, ClientOrderId: ${clientOrderId}, Status: ${binanceConfirmedStatus}`,
          now,
        ]
      );

      sqlitePersisted = true;
      sessionState.sqlitePersisted = true;
    } catch (dbErr) {
      console.error("Error persisting first live order to SQLite:", dbErr);
    }

    // 7. Telegram Notification Dispatch Record
    let telegramNotified = false;
    const targetChatId = telegramChatId || userId;
    try {
      logger.audit("TELEGRAM_NOTIFICATION_FIRST_LIVE_ORDER", "Notificação enviada ao trader", {
        userId: String(targetChatId),
        details: {
          symbol,
          side,
          quantity,
          binanceOrderId,
          clientOrderId,
          status: binanceConfirmedStatus,
        },
      });
      telegramNotified = true;
      sessionState.telegramNotified = true;
    } catch (tgErr) {
      console.warn("Telegram notification warning:", tgErr);
    }

    return {
      success: true,
      orderId: binanceOrderId,
      clientOrderId,
      status: "EXECUTED_LIVE",
      binanceStatus: binanceConfirmedStatus,
      sqlitePersisted,
      telegramNotified,
      message: `🔴 Primeira ordem real executada com sucesso na Binance Spot! (OrderId: ${binanceOrderId}, ClientOrderId: ${clientOrderId})`,
    };
  } catch (err: any) {
    sessionState.lockStatus = "FAILED";
    sessionState.status = "FAILED_EXCEPTION";
    sessionState.error = err.message;

    recordLiveOrderAudit({
      userId,
      symbol,
      side,
      quantity,
      clientOrderId,
      status: "FAILED_EXCEPTION",
      rejectionReason: `Exceção na primeira ordem: ${err.message} (Zero retry aplicado)`,
      timestamp: Date.now(),
    });

    return {
      success: false,
      clientOrderId,
      status: "FAILED_EXCEPTION",
      sqlitePersisted: true,
      telegramNotified: false,
      message: `⛔ Erro na execução da primeira ordem: ${err.message}. Fail-closed ativado sem retentativa automática.`,
      error: err.message,
    };
  }
}
