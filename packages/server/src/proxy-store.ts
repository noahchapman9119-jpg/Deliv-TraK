import * as fs from "fs";
import * as path from "path";

interface ProxyEntry {
  carrierId: string;
  trackingNumber: string;
  createdAt: string;
}

const STORE_PATH = path.join(process.cwd(), "data", "proxy-store.json");

function loadStore(): Record<string, ProxyEntry> {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Record<string, ProxyEntry>;
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, ProxyEntry>): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function generateProxyId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "TRK-";
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  id += "-";
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export function createProxy(carrierId: string, trackingNumber: string): string {
  const store = loadStore();
  const proxyId = generateProxyId();
  store[proxyId] = { carrierId, trackingNumber, createdAt: new Date().toISOString() };
  saveStore(store);
  return proxyId;
}

export function lookupProxy(proxyId: string): ProxyEntry | null {
  const store = loadStore();
  return store[proxyId.toUpperCase()] ?? null;
}
