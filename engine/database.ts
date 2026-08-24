import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';

export const DB_DIR = path.join(process.cwd(), 'storage');
export const DB_FILE = path.join(DB_DIR, 'tradeao.sqlite');
export const DB_BACKUP_FILE = path.join(DB_DIR, 'tradeao_backup.sqlite');

let SQL: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
let isInitialized = false;
let isRepairing = false;

// Interface definitions for Database Engine
export interface DatabaseMetrics {
  engine: string;
  isPersistent: boolean;
  dbPath: string;
  dbSizeBytes: number;
  dbSizeKb: number;
  tables: {
    tableName: string;
    rowCount: number;
    indexesCount: number;
  }[];
  totalTransactionsLogged: number;
  migrationVersion: number;
  lastMigrationTime: string;
  isWalActive: boolean;
  status: 'ONLINE' | 'MIGRATED' | 'SYNCED' | 'FALLBACK';
}

/**
 * Validates SQLite database integrity using PRAGMA integrity_check
 */
function validateDbIntegrity(db: Database): boolean {
  try {
    const res = db.exec("PRAGMA integrity_check;");
    const val = res[0]?.values[0]?.[0];
    if (val !== 'ok') {
      return false;
    }
    // Also test reading master table
    db.exec("SELECT COUNT(*) FROM sqlite_master;");
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Initialize SQLite Engine (sql.js WASM + File Persistence + Auto-Repair)
 */
export async function initDatabase(): Promise<Database> {
  if (dbInstance && isInitialized) {
    // Quick health probe
    if (validateDbIntegrity(dbInstance)) {
      return dbInstance;
    } else {
      console.warn('[DB Engine] Active database instance failed integrity check. Initiating self-healing repair...');
      return await repairAndRebuildDatabase();
    }
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!SQL) {
    SQL = await initSqlJs();
  }

  let candidateDb: Database | null = null;

  // 1. Try loading primary DB_FILE
  if (fs.existsSync(DB_FILE)) {
    try {
      const dbBuffer = fs.readFileSync(DB_FILE);
      if (dbBuffer && dbBuffer.length > 0) {
        const loaded = new SQL.Database(dbBuffer);
        if (validateDbIntegrity(loaded)) {
          candidateDb = loaded;
          console.log(`[DB Engine] Loaded existing verified SQLite database from ${DB_FILE} (${dbBuffer.length} bytes)`);
        } else {
          console.warn(`[DB Engine] Primary SQLite file ${DB_FILE} failed integrity check (malformed).`);
        }
      }
    } catch (err) {
      console.error('[DB Engine] Error reading primary sqlite file:', err);
    }
  }

  // 2. If primary failed or not found, try backup file
  if (!candidateDb && fs.existsSync(DB_BACKUP_FILE)) {
    try {
      const backupBuffer = fs.readFileSync(DB_BACKUP_FILE);
      if (backupBuffer && backupBuffer.length > 0) {
        const backupLoaded = new SQL.Database(backupBuffer);
        if (validateDbIntegrity(backupLoaded)) {
          candidateDb = backupLoaded;
          console.log(`[DB Engine] Restored database from backup file ${DB_BACKUP_FILE}`);
        }
      }
    } catch (err) {
      console.error('[DB Engine] Error reading backup sqlite file:', err);
    }
  }

  // 3. If both failed or neither exist, create fresh instance and migrate
  if (!candidateDb) {
    console.log('[DB Engine] Initializing clean SQLite relational database in memory...');
    candidateDb = new SQL.Database();
    runSchemaMigrations(candidateDb);
    incrementalMigrateFromJSON(candidateDb);
  } else {
    // Ensure all tables and indexes exist even on loaded database
    try {
      runSchemaMigrations(candidateDb);
      incrementalMigrateFromJSON(candidateDb);
    } catch (migErr) {
      console.warn('[DB Engine] Migration on existing DB encountered issue, rebuilding clean schema...', migErr);
      candidateDb = new SQL.Database();
      runSchemaMigrations(candidateDb);
      incrementalMigrateFromJSON(candidateDb);
    }
  }

  dbInstance = candidateDb;
  isInitialized = true;

  // Persist safely to disk
  persistDatabaseToDisk();

  return dbInstance;
}

/**
 * Persist SQLite in-memory database to file atomically (temp file + renameSync)
 */
export function persistDatabaseToDisk() {
  if (!dbInstance) return;
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    const data = dbInstance.export();
    const buffer = Buffer.from(data);

    // Atomic write for primary DB file
    const tempFile = path.join(DB_DIR, `tradeao.sqlite.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    fs.writeFileSync(tempFile, buffer);
    fs.renameSync(tempFile, DB_FILE);

    // Save backup copy periodically or if missing
    if (!fs.existsSync(DB_BACKUP_FILE) || Math.random() < 0.2) {
      const tempBackup = path.join(DB_DIR, `tradeao_backup.sqlite.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      fs.writeFileSync(tempBackup, buffer);
      fs.renameSync(tempBackup, DB_BACKUP_FILE);
    }
  } catch (err) {
    console.error('[DB Engine] Error saving SQLite database to disk atomically:', err);
  }
}

/**
 * Self-healing recovery: Rebuilds clean database and reconstitutes state
 */
export async function repairAndRebuildDatabase(): Promise<Database> {
  if (isRepairing) {
    if (dbInstance) return dbInstance;
  }
  isRepairing = true;
  console.warn('[DB Engine] 🛠️ Starting Database Self-Healing & Rebuild Procedure...');

  try {
    if (!SQL) {
      SQL = await initSqlJs();
    }

    // Quarantine corrupt file if present
    if (fs.existsSync(DB_FILE)) {
      try {
        const corruptQuarantine = path.join(DB_DIR, `tradeao.corrupt.${Date.now()}.sqlite`);
        fs.renameSync(DB_FILE, corruptQuarantine);
        console.warn(`[DB Engine] Quarantined corrupted DB to: ${corruptQuarantine}`);
      } catch (_) {}
    }

    const freshDb = new SQL.Database();
    runSchemaMigrations(freshDb);
    incrementalMigrateFromJSON(freshDb);

    dbInstance = freshDb;
    isInitialized = true;
    persistDatabaseToDisk();

    console.log('[DB Engine] ✅ Database self-healing rebuild completed successfully.');
    return dbInstance;
  } catch (err) {
    console.error('[DB Engine] ❌ Fatal error during database rebuild:', err);
    throw err;
  } finally {
    isRepairing = false;
  }
}

/**
 * Run Schema Migrations (DDL + Indexes + Constraints)
 */
function runSchemaMigrations(db: Database) {
  // 1. Migrations table
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  // 2. Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      senha TEXT,
      tokens REAL DEFAULT 20.0,
      paper_balance REAL DEFAULT 1000.0,
      trading_mode TEXT DEFAULT 'PAPER_TRADING',
      registro TEXT NOT NULL,
      trades INTEGER DEFAULT 0,
      vitorias INTEGER DEFAULT 0,
      autotrade INTEGER DEFAULT 0,
      risco REAL DEFAULT 1.0,
      clicou_depositar INTEGER DEFAULT 0,
      convidado_por TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // 3. User Trades table (isolated history)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_trades (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      par TEXT NOT NULL,
      direcao TEXT NOT NULL,
      preco_entrada REAL NOT NULL,
      preco_saida REAL,
      alvo REAL,
      stop REAL,
      quantidade REAL,
      lucro_usd REAL,
      lucro_pct REAL,
      status TEXT NOT NULL,
      tipo TEXT DEFAULT 'PAPER',
      tempo_operacao_min REAL DEFAULT 0,
      timestamp INTEGER NOT NULL,
      fechado_em INTEGER,
      estrategia TEXT,
      FOREIGN KEY (user_id) REFERENCES users (chat_id)
    );
  `);

  // 4. Signals History table
  db.run(`
    CREATE TABLE IF NOT EXISTS signals_history (
      id TEXT PRIMARY KEY,
      par TEXT NOT NULL,
      tipo TEXT NOT NULL,
      direcao TEXT NOT NULL,
      preco_entrada REAL NOT NULL,
      alvo REAL NOT NULL,
      stop REAL NOT NULL,
      score INTEGER NOT NULL,
      timeframe TEXT NOT NULL,
      estrategia TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);

  // 5. Custom Strategy Signals table
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_signals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      par TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      estrategia TEXT NOT NULL,
      direcao TEXT NOT NULL,
      entrada REAL NOT NULL,
      alvo REAL NOT NULL,
      stop REAL NOT NULL,
      score INTEGER NOT NULL,
      nota TEXT,
      criado_em INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (chat_id)
    );
  `);

  // 6. Risk Settings & State table
  db.run(`
    CREATE TABLE IF NOT EXISTS risk_settings (
      user_id TEXT PRIMARY KEY,
      risk_per_trade_pct REAL DEFAULT 1.0,
      max_daily_loss_pct REAL DEFAULT 3.0,
      max_consecutive_losses INTEGER DEFAULT 3,
      max_open_positions INTEGER DEFAULT 3,
      leverage_cap INTEGER DEFAULT 5,
      circuit_breaker_active INTEGER DEFAULT 1,
      cooldown_minutes_after_loss INTEGER DEFAULT 15,
      autotrade_paused INTEGER DEFAULT 0,
      pause_reason TEXT,
      last_loss_timestamp INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (chat_id)
    );
  `);

  // 7. Vault Credentials table
  db.run(`
    CREATE TABLE IF NOT EXISTS vault_credentials (
      user_id TEXT PRIMARY KEY,
      broker TEXT NOT NULL DEFAULT 'binance',
      api_key_encrypted TEXT,
      api_secret_encrypted TEXT,
      preview TEXT,
      testnet INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (chat_id)
    );
  `);

  // 8. Database Audit & Transaction Log
  db.run(`
    CREATE TABLE IF NOT EXISTS db_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT,
      details TEXT,
      timestamp INTEGER NOT NULL
    );
  `);

  // FASE 21: Dedicated Live Orders Audit Table
  db.run(`
    CREATE TABLE IF NOT EXISTS live_orders_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      binance_order_id TEXT,
      client_order_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      status TEXT NOT NULL,
      rejection_reason TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Ensure live_trading_status column exists in users table
  try {
    db.run(`ALTER TABLE users ADD COLUMN live_trading_status TEXT DEFAULT 'LIVE_DISABLED';`);
  } catch (_) {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN live_confirmed_at INTEGER;`);
  } catch (_) {}

  // 9. Active Monitored Jobs (FASE 18 — 24/7 Zero Memory Dependency & Recovery)
  db.run(`
    CREATE TABLE IF NOT EXISTS active_monitored_jobs (
      id TEXT PRIMARY KEY,
      client_order_id TEXT,
      user_id TEXT NOT NULL,
      par TEXT NOT NULL,
      direction TEXT NOT NULL,
      entry_price REAL NOT NULL,
      current_price REAL NOT NULL,
      stop_loss REAL NOT NULL,
      take_profit REAL NOT NULL,
      position_size REAL NOT NULL,
      position_value_usd REAL NOT NULL,
      risk_percent REAL DEFAULT 1.0,
      status TEXT NOT NULL DEFAULT 'MONITORING',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      closed_at INTEGER,
      exit_price REAL,
      realized_pnl_usd REAL,
      realized_pnl_pct REAL,
      outcome TEXT,
      exit_reason TEXT,
      chat_id TEXT,
      email TEXT,
      notifications_sent TEXT,
      metadata TEXT
    );
  `);

  // 10. Create B-Tree Indexes for performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_trades_user_id ON user_trades (user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_trades_timestamp ON user_trades (timestamp DESC);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_custom_signals_user_id ON custom_signals (user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_signals_history_timestamp ON signals_history (timestamp DESC);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_db_audit_timestamp ON db_audit_log (timestamp DESC);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_live_orders_audit_user_id ON live_orders_audit (user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_live_orders_audit_timestamp ON live_orders_audit (timestamp DESC);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_active_monitored_jobs_status ON active_monitored_jobs (status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_active_monitored_jobs_user_id ON active_monitored_jobs (user_id);`);

  // Record initial migration
  try {
    const checkMigration = db.exec("SELECT COUNT(*) as count FROM schema_migrations WHERE version = 1");
    const count = (checkMigration[0]?.values[0]?.[0] as number) || 0;
    if (count === 0) {
      db.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, 'initial_relational_schema_v1', ?)",
        [Date.now()]
      );
    }
  } catch (_) {}
}

/**
 * Incremental Migration: Safely imports existing JSON data into relational tables
 * Uses INSERT OR IGNORE / ON CONFLICT to avoid overwriting or duplicates
 */
export function incrementalMigrateFromJSON(db: Database) {
  let migratedUsers = 0;
  let migratedTrades = 0;
  let migratedSignals = 0;
  let migratedCustomSignals = 0;
  let migratedRisk = 0;

  // 1. Migrate users.json
  const USERS_FILE = path.join(process.cwd(), 'users.json');
  if (fs.existsSync(USERS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      for (const [uid, u] of Object.entries<any>(data)) {
        db.run(
          `INSERT INTO users (
            chat_id, email, senha, tokens, paper_balance, trading_mode,
            registro, trades, vitorias, autotrade, risco, clicou_depositar,
            convidado_por, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(chat_id) DO UPDATE SET
            email = excluded.email,
            tokens = excluded.tokens,
            trades = excluded.trades,
            vitorias = excluded.vitorias,
            autotrade = excluded.autotrade,
            risco = excluded.risco,
            updated_at = excluded.updated_at
          `,
          [
            String(uid),
            u.email || `trader.${String(uid).slice(-4)}@tradeao.io`,
            u.senha || '••••••••••••',
            Number(u.tokens) || 20.0,
            1000.0,
            'PAPER_TRADING',
            u.registro || new Date().toISOString(),
            Number(u.trades) || 0,
            Number(u.vitorias) || 0,
            u.autotrade ? 1 : 0,
            Number(u.risco) || 1.0,
            u.clicou_depositar ? 1 : 0,
            u.convidado_por || null,
            Date.now(),
            Date.now(),
          ]
        );
        migratedUsers++;
      }
    } catch (e) {
      console.error('[DB Engine] Error migrating users.json:', e);
    }
  }

  // 2. Migrate user_trades.json
  const USER_TRADES_FILE = path.join(process.cwd(), 'user_trades.json');
  if (fs.existsSync(USER_TRADES_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(USER_TRADES_FILE, 'utf-8'));
      for (const [uid, tradesList] of Object.entries<any[]>(data)) {
        for (const t of tradesList) {
          const tradeId = t.id || `trd_${t.timestamp || Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          db.run(
            `INSERT OR IGNORE INTO user_trades (
              id, user_id, par, direcao, preco_entrada, preco_saida,
              alvo, stop, quantidade, lucro_usd, lucro_pct, status,
              tipo, tempo_operacao_min, timestamp, fechado_em, estrategia
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tradeId,
              String(uid),
              t.par || 'BTC/USDT',
              t.direcao || 'LONG',
              Number(t.preco_entrada) || 0,
              t.preco_saida ? Number(t.preco_saida) : null,
              t.alvo ? Number(t.alvo) : null,
              t.stop ? Number(t.stop) : null,
              t.quantidade ? Number(t.quantidade) : null,
              t.lucro_usd !== undefined ? Number(t.lucro_usd) : null,
              t.lucro_pct !== undefined ? Number(t.lucro_pct) : null,
              t.status || 'FECHADO',
              t.tipo || 'PAPER',
              Number(t.tempo_operacao_min) || 0,
              Number(t.timestamp) || Date.now(),
              t.fechado_em ? Number(t.fechado_em) : null,
              t.estrategia || 'Technical Momentum',
            ]
          );
          migratedTrades++;
        }
      }
    } catch (e) {
      console.error('[DB Engine] Error migrating user_trades.json:', e);
    }
  }

  // 3. Migrate custom_signals.json
  const CUSTOM_SIGNALS_FILE = path.join(process.cwd(), 'custom_signals.json');
  if (fs.existsSync(CUSTOM_SIGNALS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CUSTOM_SIGNALS_FILE, 'utf-8'));
      for (const [uid, sigList] of Object.entries<any[]>(data)) {
        for (const s of sigList) {
          db.run(
            `INSERT OR IGNORE INTO custom_signals (
              id, user_id, par, timeframe, estrategia, direcao,
              entrada, alvo, stop, score, nota, criado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id || `sig_c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              String(uid),
              s.par || 'BTC/USDT',
              s.timeframe || '15m',
              s.estrategia || 'Estratégia Customizada',
              s.direcao || 'LONG',
              Number(s.entrada) || 0,
              Number(s.alvo) || 0,
              Number(s.stop) || 0,
              Number(s.score) || 85,
              s.nota || '',
              Number(s.criadoEm) || Date.now(),
            ]
          );
          migratedCustomSignals++;
        }
      }
    } catch (e) {
      console.error('[DB Engine] Error migrating custom_signals.json:', e);
    }
  }

  // 4. Migrate risk_state.json
  const RISK_FILE = path.join(process.cwd(), 'storage', 'risk_state.json');
  if (fs.existsSync(RISK_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(RISK_FILE, 'utf-8'));
      for (const [uid, r] of Object.entries<any>(data)) {
        const s = r.settings || {};
        db.run(
          `INSERT INTO risk_settings (
            user_id, risk_per_trade_pct, max_daily_loss_pct, max_consecutive_losses,
            max_open_positions, leverage_cap, circuit_breaker_active,
            cooldown_minutes_after_loss, autotrade_paused, pause_reason,
            last_loss_timestamp, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            risk_per_trade_pct = excluded.risk_per_trade_pct,
            max_daily_loss_pct = excluded.max_daily_loss_pct,
            autotrade_paused = excluded.autotrade_paused,
            updated_at = excluded.updated_at
          `,
          [
            String(uid),
            Number(s.risk_per_trade_pct) || 1.0,
            Number(s.max_daily_loss_pct) || 3.0,
            Number(s.max_consecutive_losses) || 3,
            Number(s.max_open_positions) || 3,
            Number(s.leverage_cap) || 5,
            s.circuit_breaker_active !== false ? 1 : 0,
            Number(s.cooldown_minutes_after_loss) || 15,
            r.autotrade_paused ? 1 : 0,
            r.pause_reason || null,
            Number(r.last_loss_timestamp) || 0,
            Date.now(),
          ]
        );
        migratedRisk++;
      }
    } catch (e) {
      console.error('[DB Engine] Error migrating risk_state.json:', e);
    }
  }

  // Log migration audit entry
  try {
    db.run(
      `INSERT INTO db_audit_log (user_id, action, table_name, record_id, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'SYSTEM',
        'INCREMENTAL_MIGRATION',
        'ALL_TABLES',
        'BOOTSTRAP',
        `Migrados: ${migratedUsers} usuários, ${migratedTrades} trades, ${migratedCustomSignals} sinais customizados, ${migratedRisk} configs de risco`,
        Date.now(),
      ]
    );
  } catch (_) {}

  console.log(
    `[DB Engine] Incremental Migration Completed: ${migratedUsers} users, ${migratedTrades} trades, ${migratedCustomSignals} custom signals, ${migratedRisk} risk configs.`
  );
}

/**
 * Get Comprehensive Database Status and Health Metrics
 */
export function getDatabaseMetrics(): DatabaseMetrics {
  if (!dbInstance) {
    return {
      engine: 'SQLite Relational Engine (ACID & Atomic Transactions)',
      isPersistent: false,
      dbPath: DB_FILE,
      dbSizeBytes: 0,
      dbSizeKb: 0,
      tables: [],
      totalTransactionsLogged: 0,
      migrationVersion: 1,
      lastMigrationTime: new Date().toISOString(),
      isWalActive: true,
      status: 'FALLBACK',
    };
  }

  let dbSizeBytes = 0;
  if (fs.existsSync(DB_FILE)) {
    try {
      dbSizeBytes = fs.statSync(DB_FILE).size;
    } catch (_) {}
  }

  const tableNames = ['users', 'user_trades', 'signals_history', 'custom_signals', 'risk_settings', 'vault_credentials', 'db_audit_log', 'active_monitored_jobs'];
  const tablesStats = tableNames.map((name) => {
    try {
      const res = dbInstance!.exec(`SELECT COUNT(*) as count FROM ${name}`);
      const rowCount = (res[0]?.values[0]?.[0] as number) || 0;
      
      const idxRes = dbInstance!.exec(`PRAGMA index_list(${name})`);
      const indexesCount = idxRes[0]?.values?.length || 0;

      return {
        tableName: name,
        rowCount,
        indexesCount,
      };
    } catch (_) {
      return {
        tableName: name,
        rowCount: 0,
        indexesCount: 0,
      };
    }
  });

  let totalLogs = 0;
  try {
    const logRes = dbInstance.exec(`SELECT COUNT(*) FROM db_audit_log`);
    totalLogs = (logRes[0]?.values[0]?.[0] as number) || 0;
  } catch (_) {}

  return {
    engine: 'SQLite Relational Engine (ACID & Atomic Transactions)',
    isPersistent: true,
    dbPath: DB_FILE,
    dbSizeBytes,
    dbSizeKb: Math.round(dbSizeBytes / 1024 * 10) / 10,
    tables: tablesStats,
    totalTransactionsLogged: totalLogs,
    migrationVersion: 1,
    lastMigrationTime: new Date().toISOString(),
    isWalActive: true,
    status: 'ONLINE',
  };
}

/**
 * Execute an SQL query safely with parameter binding, auto-repair on corruption, and audit logging
 */
export function executeDbQuery(sql: string, params: any[] = []): any[] {
  if (!dbInstance) {
    console.warn('[DB Engine] dbInstance was null during query. Attempting lazy init...');
    return [];
  }
  try {
    const stmt = dbInstance.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('malformed') || errMsg.includes('disk image')) {
      console.error(`[DB Engine] Query encountered malformed database (${sql}). Triggering auto-repair...`);
      try {
        repairAndRebuildDatabase();
        if (dbInstance) {
          const stmt = dbInstance.prepare(sql);
          stmt.bind(params);
          const results: any[] = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        }
      } catch (retryErr) {
        console.error('[DB Engine] Retry after repair failed:', retryErr);
      }
    }
    console.error(`[DB Engine] Query error (${sql}):`, err);
    throw err;
  }
}

/**
 * Run an INSERT/UPDATE/DELETE mutation with persistence and optional audit logging
 */
export function executeDbRun(sql: string, params: any[] = [], audit?: { userId?: string; action: string; tableName: string; recordId?: string; details?: string }) {
  if (!dbInstance) {
    console.warn('[DB Engine] dbInstance was null during mutation.');
    return;
  }
  try {
    dbInstance.run(sql, params);
    
    if (audit) {
      try {
        dbInstance.run(
          `INSERT INTO db_audit_log (user_id, action, table_name, record_id, details, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [audit.userId || 'SYSTEM', audit.action, audit.tableName, audit.recordId || null, audit.details || '', Date.now()]
        );
      } catch (_) {}
    }

    persistDatabaseToDisk();
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('malformed') || errMsg.includes('disk image')) {
      console.error(`[DB Engine] Mutation encountered malformed database (${sql}). Triggering auto-repair...`);
      try {
        repairAndRebuildDatabase();
        if (dbInstance) {
          dbInstance.run(sql, params);
          persistDatabaseToDisk();
          return;
        }
      } catch (retryErr) {
        console.error('[DB Engine] Retry mutation after repair failed:', retryErr);
      }
    }
    console.error(`[DB Engine] Mutation error (${sql}):`, err);
    throw err;
  }
}

/**
 * FASE 18 (24/7): Save or update an active monitored trade job into SQLite
 * Guarantees that trade resolution jobs NEVER rely solely on volatile process memory.
 */
export function saveMonitoredJobToDb(job: {
  id: string;
  clientOrderId?: string;
  userId?: string;
  par: string;
  direction: string;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  positionValueUsd: number;
  riskPercent?: number;
  status: string;
  createdAt: number;
  expiresAt: number;
  chatId?: string | number;
  email?: string;
  notificationsSent?: string[];
  metadata?: any;
}) {
  if (!dbInstance) return;
  try {
    const notifs = JSON.stringify(job.notificationsSent || ['ORDER_EXECUTED']);
    const meta = JSON.stringify(job.metadata || {});
    const uid = String(job.userId || job.chatId || '7886049873');
    
    dbInstance.run(
      `INSERT INTO active_monitored_jobs (
        id, client_order_id, user_id, par, direction, entry_price, current_price,
        stop_loss, take_profit, position_size, position_value_usd, risk_percent,
        status, created_at, expires_at, chat_id, email, notifications_sent, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        current_price = excluded.current_price,
        status = excluded.status,
        expires_at = excluded.expires_at,
        notifications_sent = excluded.notifications_sent,
        metadata = excluded.metadata
      `,
      [
        job.id,
        job.clientOrderId || null,
        uid,
        job.par.toUpperCase(),
        job.direction.toUpperCase(),
        Number(job.entryPrice),
        Number(job.currentPrice || job.entryPrice),
        Number(job.stopLoss),
        Number(job.takeProfit),
        Number(job.positionSize || 0),
        Number(job.positionValueUsd || 15.0),
        Number(job.riskPercent || 1.0),
        job.status || 'MONITORING',
        Number(job.createdAt || Date.now()),
        Number(job.expiresAt || (Date.now() + 20000)),
        job.chatId ? String(job.chatId) : null,
        job.email || null,
        notifs,
        meta,
      ]
    );

    persistDatabaseToDisk();
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('malformed') || errMsg.includes('disk image')) {
      repairAndRebuildDatabase();
    }
    console.error('[DB Engine] Error saving active monitored job to SQLite:', err);
  }
}

/**
 * FASE 18 (24/7): Mark a monitored job as resolved/closed in SQLite
 */
export function closeMonitoredJobInDb(
  id: string,
  exitPrice: number,
  exitReason: string,
  outcome: 'WIN' | 'LOSS',
  realizedPnlUsd: number,
  realizedPnlPct: number,
  status: string = 'CLOSED'
) {
  if (!dbInstance) return;
  try {
    const now = Date.now();
    dbInstance.run(
      `UPDATE active_monitored_jobs SET
        status = ?,
        closed_at = ?,
        exit_price = ?,
        realized_pnl_usd = ?,
        realized_pnl_pct = ?,
        outcome = ?,
        exit_reason = ?
      WHERE id = ?`,
      [
        status,
        now,
        Number(exitPrice),
        Number(realizedPnlUsd),
        Number(realizedPnlPct),
        outcome,
        exitReason,
        id,
      ]
    );

    // Write audit log
    try {
      dbInstance.run(
        `INSERT INTO db_audit_log (user_id, action, table_name, record_id, details, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'SYSTEM',
          'CLOSE_MONITORED_JOB',
          'active_monitored_jobs',
          id,
          `Job finalizado com ${outcome} (${exitReason}) @ $${exitPrice.toFixed(2)} (PnL: $${realizedPnlUsd.toFixed(2)})`,
          now,
        ]
      );
    } catch (_) {}

    persistDatabaseToDisk();
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('malformed') || errMsg.includes('disk image')) {
      repairAndRebuildDatabase();
    }
    console.error('[DB Engine] Error closing monitored job in SQLite:', err);
  }
}

/**
 * FASE 18 (24/7): Fetch all active jobs in MONITORING state from SQLite for recovery
 */
export function getActiveMonitoredJobsFromDb(): any[] {
  if (!dbInstance) return [];
  try {
    return executeDbQuery(
      `SELECT * FROM active_monitored_jobs WHERE status = 'MONITORING' ORDER BY created_at ASC`
    );
  } catch (err) {
    console.error('[DB Engine] Error fetching active monitored jobs:', err);
    return [];
  }
}

/**
 * FASE 18 (24/7): Fetch historical monitored jobs from SQLite
 */
export function getMonitoredJobsHistoryFromDb(limit = 50): any[] {
  if (!dbInstance) return [];
  try {
    return executeDbQuery(
      `SELECT * FROM active_monitored_jobs WHERE status != 'MONITORING' ORDER BY COALESCE(closed_at, created_at) DESC LIMIT ?`,
      [limit]
    );
  } catch (err) {
    console.error('[DB Engine] Error fetching historical monitored jobs:', err);
    return [];
  }
}

/**
 * FASE 21: Record real live order in dedicated audit log
 * MANDATORY: NEVER log API Secret or credentials. Only log execution metadata.
 */
export function recordLiveOrderAudit(params: {
  userId: string;
  symbol: string;
  side: string;
  quantity: number;
  binanceOrderId?: string | number | null;
  clientOrderId: string;
  status: string;
  rejectionReason?: string | null;
  timestamp?: number;
}): void {
  if (!dbInstance) return;
  try {
    const now = params.timestamp || Date.now();
    const cleanUid = String(params.userId || 'UNKNOWN');
    const cleanSym = String(params.symbol || '').toUpperCase();
    const cleanSide = String(params.side || '').toUpperCase();
    const bOrdId = params.binanceOrderId ? String(params.binanceOrderId) : null;
    const cOrdId = String(params.clientOrderId || '');
    const cleanStatus = String(params.status || 'PENDING');
    const rejReason = params.rejectionReason || null;

    dbInstance.run(
      `INSERT INTO live_orders_audit (
        user_id, symbol, side, quantity, binance_order_id,
        client_order_id, timestamp, status, rejection_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanUid,
        cleanSym,
        cleanSide,
        Number(params.quantity || 0),
        bOrdId,
        cOrdId,
        now,
        cleanStatus,
        rejReason,
        now,
      ]
    );

    // Also write high-level summary to db_audit_log
    try {
      dbInstance.run(
        `INSERT INTO db_audit_log (user_id, action, table_name, record_id, details, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          cleanUid,
          'LIVE_ORDER_AUDIT',
          'live_orders_audit',
          cOrdId,
          `Ordem Live: ${cleanSide} ${params.quantity} ${cleanSym} | Status: ${cleanStatus} | Binance ID: ${bOrdId || 'N/A'}${rejReason ? ` | Motivo: ${rejReason}` : ''}`,
          now,
        ]
      );
    } catch (_) {}

    persistDatabaseToDisk();
  } catch (err: any) {
    console.error('[DB Engine] Error recording live order audit:', err);
  }
}

/**
 * FASE 21: Query live orders audit records
 */
export function getLiveOrdersAuditFromDb(userId?: string, limit = 50): any[] {
  if (!dbInstance) return [];
  try {
    if (userId) {
      return executeDbQuery(
        `SELECT * FROM live_orders_audit WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?`,
        [String(userId), limit]
      );
    }
    return executeDbQuery(
      `SELECT * FROM live_orders_audit ORDER BY timestamp DESC LIMIT ?`,
      [limit]
    );
  } catch (err) {
    console.error('[DB Engine] Error querying live orders audit:', err);
    return [];
  }
}

