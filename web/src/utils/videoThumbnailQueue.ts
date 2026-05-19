/** Limits concurrent local-file thumbnail decodes so the UI stays smooth. */
const MAX_CONCURRENT = 2;
let active = 0;
const waitQueue: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  active += 1;
}

function release(): void {
  active -= 1;
  const next = waitQueue.shift();
  if (next) next();
}

export async function withThumbnailSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
