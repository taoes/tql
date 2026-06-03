/** Combine two AbortSignals so either one aborts the operation */
export function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => {
    controller.abort();
    a.removeEventListener("abort", onAbort);
    b.removeEventListener("abort", onAbort);
  };

  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);

  if (a.aborted || b.aborted) {
    controller.abort();
  }

  return controller.signal;
}
