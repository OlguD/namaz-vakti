/**
 * Web build: local notifications are not available in browsers we target, so
 * every call is a no-op (and expo-notifications is never loaded on web).
 */
import type { PlannedNotification } from './schedule';
import type { PermissionState } from './sounds';

export type { PermissionState } from './sounds';
export const IS_SUPPORTED = false;

export async function getNotificationPermission(): Promise<PermissionState> {
  return 'unsupported';
}
export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}
export async function ensureChannels(): Promise<void> {}
export async function applyPlan(_plan: readonly PlannedNotification[]): Promise<void> {}
export async function clearPlan(): Promise<void> {}
export async function getPushToken(): Promise<string | null> {
  return null;
}
export async function installationId(): Promise<string | null> {
  return null;
}
