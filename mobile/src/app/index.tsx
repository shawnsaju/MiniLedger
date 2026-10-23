import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { setToken, setUnauthorizedHandler } from '../api';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { clearToken, loadToken, saveToken } from '../session';
import { colors } from '../theme';

export default function Index() {
  // undefined = still reading the saved token, null = logged out, string = logged in
  const [session, setSession] = useState<string | null | undefined>(undefined);
  const [notice, setNotice] = useState<string>();

  const logout = useCallback(async (reason?: string) => {
    setToken(null);
    await clearToken();
    setNotice(reason);
    setSession(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout('Your session expired. Log in again.'));
    loadToken().then((saved) => {
      setToken(saved);
      setSession(saved);
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const handleLoggedIn = useCallback(async (token: string) => {
    await saveToken(token);
    setToken(token);
    setNotice(undefined);
    setSession(token);
  }, []);

  return session === undefined ? (
    <View style={styles.splash}>
      <ActivityIndicator color={colors.ink} />
    </View>
  ) : session ? (
    <HomeScreen onLogout={() => logout()} />
  ) : (
    <LoginScreen notice={notice} onLoggedIn={handleLoggedIn} />
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
});
