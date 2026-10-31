/** Gom bản ghi rồi ghi xuống DB theo lô định kỳ, thay vì mỗi hành động một lần ghi. */
export class Batcher<T> {
  private items: T[] = [];
  private timer?: NodeJS.Timeout;
  private flushing?: Promise<void>;

  constructor(
    private write: (items: T[]) => Promise<void>,
    private intervalMs: number,
    private onError: (err: unknown) => void,
    private maxItems = 500,
  ) {}

  push(item: T) {
    this.items.push(item);
    if (this.items.length >= this.maxItems) void this.flush();
  }

  start() {
    this.timer ??= setInterval(() => void this.flush(), this.intervalMs);
    this.timer.unref();
  }

  async flush() {
    await this.flushing;
    if (this.items.length === 0) return;
    const batch = this.items;
    this.items = [];
    this.flushing = this.write(batch).catch((err) => {
      this.items.unshift(...batch); // ghi lỗi → giữ lại, thử ở lần sau
      this.onError(err);
    });
    await this.flushing;
    this.flushing = undefined;
  }

  async stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    await this.flush();
  }
}
