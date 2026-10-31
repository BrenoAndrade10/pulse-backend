/**
 * Cache em memória com validade, por instância do processo. Para dados que
 * podem ficar alguns segundos desatualizados (configuração do pixel) e são
 * lidos a cada evento.
 */
export class MemoryCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly loading = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 10_000,
  ) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      return entry.value;
    }

    const pending = this.loading.get(key);
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => this.loading.delete(key));
    this.loading.set(key, promise);
    return promise;
  }

  peek(key: string): T | undefined {
    const entry = this.entries.get(key);
    return entry && entry.expiresAt > Date.now() ? entry.value : undefined;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

/** Limite de pedidos por chave numa janela fixa (ex.: IP + pixel por minuto). */
export class WindowRateLimiter {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 50_000,
  ) {}

  /** Consome `amount`; `false` se passou do limite. */
  take(key: string, amount = 1): boolean {
    const now = Date.now();
    let window = this.windows.get(key);

    if (!window || window.resetAt <= now) {
      if (this.windows.size >= this.maxKeys) this.sweep(now);
      this.windows.delete(key);
      if (this.windows.size >= this.maxKeys) {
        const oldest = this.windows.keys().next();
        if (!oldest.done) this.windows.delete(oldest.value);
      }
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }

    window.count += amount;
    return window.count <= this.limit;
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
