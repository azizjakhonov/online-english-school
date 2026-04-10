/**
 * usePushToken
 *
 * Requests Expo push notification permission and registers the device token
 * with the backend marketing service (POST /api/marketing/push-tokens/).
 *
 * Call this once from a component that is only mounted while the user is
 * authenticated — e.g. MainTabNavigator — so the effect fires exactly once
 * per login session without needing to pass an `isAuthenticated` flag.
 *
 * Backend upserts by (user, token), so duplicate calls are safe.
 *
 * Notes
 * ─────
 * • Expo push tokens require a physical device. On simulators,
 *   getExpoPushTokenAsync() throws — the error is caught and logged silently.
 * • The projectId is read from expo-constants so it stays in sync with
 *   app.json and doesn't need to be hardcoded here.
 */

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import client from '../api/client';

export function usePushToken(): void {
  useEffect(() => {
    let cancelled = false;

    async function register() {
      // 1. Ask the user for permission (no-op if already granted or denied).
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      // 2. Resolve the Expo project ID from app.json extra.eas.projectId.
      //    Required by getExpoPushTokenAsync in SDK 49+ for Expo Go / dev builds.
      const projectId: string | undefined =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;

      // 3. Fetch the Expo push token.
      //    Throws on simulators — caught below and logged silently in dev.
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );

      if (cancelled) return;

      // 4. Register with the backend — upsert by (user, token).
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      await client.post('/api/marketing/push-tokens/', {
        token: tokenData.data,
        platform,
      });
    }

    register().catch((err) => {
      if (__DEV__) {
        // On physical devices permission errors are expected;
        // on simulators the token API will throw — both are non-fatal.
        console.log('[usePushToken]', err?.message ?? err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []); // runs once on mount — component is only mounted when authenticated
}
