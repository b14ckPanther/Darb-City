import type { FieldCaptureCreateInput } from "@darb/contracts";

/**
 * Street captures wait on the phone until the API has them: a weak signal never loses a shop.
 * IndexedDB keeps them across reloads; when it cannot be opened (a private window, blocked
 * storage), a memory store keeps them for as long as the page is open, and the page says so.
 */

export type QueueState = "waiting" | "sending" | "failed" | "refused";

export interface QueuedCapture {
  clientId: string;
  createdAt: string;
  /** What the list shows: the name the admin typed. */
  label: string;
  /** The downscaled storefront photo, until it is uploaded. */
  photo: Blob | null;
  /** Set once the photo is in the bucket, so a retry never uploads it again. */
  photoKey: string | null;
  body: Omit<FieldCaptureCreateInput, "photo">;
  state: QueueState;
  /** For "refused": the API's reason, shown as it is. */
  error?: string;
}

export interface QueueStore {
  readonly persistent: boolean;
  all(): Promise<QueuedCapture[]>;
  put(item: QueuedCapture): Promise<void>;
  remove(clientId: string): Promise<void>;
}

export function memoryStore(): QueueStore {
  const items = new Map<string, QueuedCapture>();
  return {
    persistent: false,
    all: async () => [...items.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    put: async (item) => void items.set(item.clientId, item),
    remove: async (id) => void items.delete(id),
  };
}

const DB = "darb-street";
const STORE = "captures";

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "clientId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

/** IndexedDB, or the memory store when it cannot be used. Never throws. */
export async function openQueue(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): Promise<QueueStore> {
  let db: IDBDatabase;
  try {
    if (!factory) return memoryStore();
    db = await openDb(factory);
  } catch {
    return memoryStore();
  }
  // Each call opens its own transaction; a failing one falls back to memory for that item only.
  const fallback = memoryStore();
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    persistent: true,
    all: async () => {
      try {
        const rows = (await done(tx("readonly").getAll())) as QueuedCapture[];
        const extra = await fallback.all();
        return [...rows, ...extra].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      } catch {
        return fallback.all();
      }
    },
    put: async (item) => {
      try {
        await done(tx("readwrite").put(item));
      } catch {
        await fallback.put(item);
      }
    },
    remove: async (id) => {
      await fallback.remove(id);
      try {
        await done(tx("readwrite").delete(id));
      } catch {
        // Already gone, or storage went away: nothing left to do.
      }
    },
  };
}

/** What one send attempt ended as. */
export type SendOutcome =
  | { kind: "sent" }
  | { kind: "offline" }
  | { kind: "failed" }
  | { kind: "refused"; message: string }
  | { kind: "signed-out" };

export interface SendDeps {
  /** The admin's own routes (/admin/field-api/…), or a fake in tests. */
  fetch: typeof fetch;
  base: string;
  store: QueueStore;
}

const messageOf = (body: unknown) => {
  const m = (body as { message?: unknown } | null)?.message;
  return Array.isArray(m) ? m.join("; ") : typeof m === "string" ? m : "";
};

/**
 * One capture: the photo first (its key is kept on the item at once), then the capture with the
 * same clientId every time, so the API answers the first one if an earlier try got through.
 */
export async function sendCapture(item: QueuedCapture, deps: SendDeps): Promise<SendOutcome> {
  let current = item;
  try {
    if (current.photo && !current.photoKey) {
      const form = new FormData();
      form.append("file", current.photo, "sign.jpg");
      const res = await deps.fetch(`${deps.base}/photo`, { method: "POST", body: form });
      if (res.status === 401) return { kind: "signed-out" };
      if (res.status === 201) {
        const { key } = (await res.json()) as { key: string | null };
        // No key: this server keeps no photos; the shop goes without one.
        current = { ...current, photoKey: key, photo: key ? current.photo : null };
        await deps.store.put(current);
      } else if (res.status === 400 || res.status === 413) {
        // The photo itself is refused (not an image, too large): the shop still goes.
        current = { ...current, photo: null };
        await deps.store.put(current);
      } else return { kind: "failed" };
    }
    const res = await deps.fetch(`${deps.base}/captures`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...current.body, photo: current.photoKey }),
    });
    if (res.status === 200 || res.status === 201) {
      await deps.store.remove(current.clientId);
      return { kind: "sent" };
    }
    if (res.status === 401) return { kind: "signed-out" };
    if (res.status === 400) {
      const message = messageOf(await res.json().catch(() => null)) || String(res.status);
      await deps.store.put({ ...current, state: "refused", error: message });
      return { kind: "refused", message };
    }
    return { kind: "failed" };
  } catch {
    // fetch itself threw: no connection.
    return { kind: "offline" };
  }
}

/**
 * Sends everything waiting, oldest first; stops at the first sign of no connection (the rest would
 * fail the same way). Refused items stay for the admin to remove.
 */
export async function flushQueue(
  deps: SendDeps,
  onChange: (items: QueuedCapture[]) => void = () => undefined,
): Promise<{ sent: number; offline: boolean }> {
  let sent = 0;
  for (const item of await deps.store.all()) {
    if (item.state === "refused") continue;
    await deps.store.put({ ...item, state: "sending" });
    onChange(await deps.store.all());
    const out = await sendCapture({ ...item, state: "sending" }, deps);
    if (out.kind === "sent") sent++;
    else if (out.kind !== "refused") {
      const latest = (await deps.store.all()).find((i) => i.clientId === item.clientId) ?? item;
      await deps.store.put({ ...latest, state: out.kind === "offline" ? "waiting" : "failed" });
    }
    onChange(await deps.store.all());
    if (out.kind === "offline" || out.kind === "signed-out") return { sent, offline: true };
  }
  return { sent, offline: false };
}
