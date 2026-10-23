import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;

/**
 * Where is the backend?
 *  1. EXPO_PUBLIC_API_URL if set (needed for tunnels / deployed servers).
 *  2. Otherwise the machine running the Expo dev server: Expo Go already knows its address
 *     (hostUri, e.g. "192.168.1.20:8081"), and the backend runs on that same machine.
 *  3. Otherwise the emulator's alias for the host machine.
 */
function guessApiUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;
  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? guessApiUrl()).replace(/\/+$/, '');
