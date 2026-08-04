import type { AuthUser, PlatformCapability } from '@shared/types';

/** True when the user is workspace owner or their role includes the capability. */
export function hasPlatformCapability(
  user: AuthUser | null | undefined,
  capability: PlatformCapability,
): boolean {
  if (!user) return false;
  if (user.isWorkspaceOwner) return true;
  return user.platformCapabilities?.includes(capability) === true;
}

export function hasAnyPlatformCapability(
  user: AuthUser | null | undefined,
  ...capabilities: PlatformCapability[]
): boolean {
  return capabilities.some((c) => hasPlatformCapability(user, c));
}
