export function wait(timeout: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, timeout);
  });
}
