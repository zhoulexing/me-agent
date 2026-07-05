type Task<T> = () => Promise<T>;

export class SessionQueue {
  private readonly tails = new Map<string, Promise<unknown>>();

  enqueue<T>(queueKey: string, task: Task<T>): Promise<T> {
    const previous = this.tails.get(queueKey) ?? Promise.resolve();
    const next = previous.then(task, task);

    const tail = next
      .catch(() => undefined)
      .finally(() => {
        if (this.tails.get(queueKey) === tail) {
          this.tails.delete(queueKey);
        }
      });

    this.tails.set(queueKey, tail);

    return next;
  }
}
