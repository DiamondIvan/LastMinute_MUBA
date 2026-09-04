import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../../data/news_db.json');

// Interface for what we store
interface DBData {
  latestForecast: {
    timestamp: number;
    data: any;
  } | null;
  newsImpacts: Record<string, {
    timestamp: number;
    data: any;
  }>;
}

// In-memory cache for fast access
let memCache: DBData | null = null;

async function ensureDBFile() {
  const dir = path.dirname(DB_PATH);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ latestForecast: null, newsImpacts: {} }), 'utf-8');
  }
}

async function loadDB(): Promise<DBData> {
  if (memCache) return memCache;
  await ensureDBFile();
  const raw = await fs.readFile(DB_PATH, 'utf-8');
  try {
    memCache = JSON.parse(raw);
  } catch (e) {
    memCache = { latestForecast: null, newsImpacts: {} };
  }
  return memCache!;
}

async function saveDB() {
  if (!memCache) return;
  await fs.writeFile(DB_PATH, JSON.stringify(memCache, null, 2), 'utf-8');
}

export async function getCachedForecast(): Promise<any | null> {
  const db = await loadDB();
  if (!db.latestForecast) return null;
  
  // Cache for 1 hour to avoid constant AI calls
  const ONE_HOUR = 60 * 60 * 1000;
  if (Date.now() - db.latestForecast.timestamp > ONE_HOUR) {
    return null;
  }
  return db.latestForecast.data;
}

export async function setCachedForecast(data: any): Promise<void> {
  const db = await loadDB();
  db.latestForecast = {
    timestamp: Date.now(),
    data
  };
  await saveDB();
}

export async function getCachedNewsImpact(cacheKey: string): Promise<any | null> {
  const db = await loadDB();
  const entry = db.newsImpacts[cacheKey];
  if (!entry) return null;
  
  // Impact analysis caches for 24 hours
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (Date.now() - entry.timestamp > ONE_DAY) {
    return null;
  }
  return entry.data;
}

export async function setCachedNewsImpact(cacheKey: string, data: any): Promise<void> {
  const db = await loadDB();
  db.newsImpacts[cacheKey] = {
    timestamp: Date.now(),
    data
  };
  await saveDB();
}

export async function getCachedCoinAnalysis(symbol: string): Promise<any | null> {
  const db = await loadDB();
  // We can just reuse newsImpacts object for simplicity or create a new one. Let's reuse newsImpacts dictionary as a generic cache dict.
  const entry = db.newsImpacts[`coin-${symbol}`];
  if (!entry) return null;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (Date.now() - entry.timestamp > ONE_DAY) return null;
  return entry.data;
}

export async function setCachedCoinAnalysis(symbol: string, data: any): Promise<void> {
  const db = await loadDB();
  db.newsImpacts[`coin-${symbol}`] = {
    timestamp: Date.now(),
    data
  };
  await saveDB();
}
