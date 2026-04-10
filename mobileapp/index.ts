// ── LiveKit WebRTC globals MUST be registered before anything else ────────────
// Without this, livekit-client throws "WebRTC isn't detected, have you called
// registration?" and the video room shows "Video Unavailable".
// Wrapped in try/catch so the app still loads in Expo Go (no native WebRTC).
try {
  const { registerGlobals } = require('@livekit/react-native');
  registerGlobals();
} catch (_) {
  console.warn('LiveKit native module not available — classroom video will be disabled.');
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
