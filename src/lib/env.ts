export function readTrimmedEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readPrivateKeyEnv(
  value: string | undefined,
): string | undefined {
  return readTrimmedEnv(value)?.replace(/\\n/g, "\n").trim();
}

export function getFirebaseProjectId(): string | undefined {
  return (
    readTrimmedEnv(import.meta.env.PUBLIC_FIREBASE_PROJECT_ID) ??
    readTrimmedEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID)
  );
}
