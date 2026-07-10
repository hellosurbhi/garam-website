export function getFriendFirstName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}
