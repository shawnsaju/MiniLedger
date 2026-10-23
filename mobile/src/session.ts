import * as SecureStore from 'expo-secure-store';

// The JWT lives in the OS keychain/keystore (not AsyncStorage) so it survives restarts securely.
const KEY = 'miniledger.token';

export const loadToken = () => SecureStore.getItemAsync(KEY).catch(() => null);
export const saveToken = (token: string) => SecureStore.setItemAsync(KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(KEY).catch(() => undefined);
