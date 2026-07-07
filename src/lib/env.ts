export function readTrimmedEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readPrivateKeyEnv(
  value: string | undefined,
): string | undefined {
  return readTrimmedEnv(value)?.replace(/\\n/g, "\n").trim();
}
