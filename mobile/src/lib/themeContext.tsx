import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { applyScheme } from './theme';

export type Pref = 'system' | 'light' | 'dark';
const Ctx = createContext<{ pref: Pref; setPref: (p: Pref) => void; scheme: 'light' | 'dark' }>({ pref: 'system', setPref: () => undefined, scheme: 'light' });
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: (scheme: 'light' | 'dark') => ReactNode }) {
  const sys = useColorScheme();
  const [pref, setPrefState] = useState<Pref | null>(null);
  useEffect(() => { AsyncStorage.getItem('themePref').then((v) => setPrefState(v === 'light' || v === 'dark' ? v : 'system')).catch(() => setPrefState('system')); }, []);
  if (!pref) return null;
  const scheme: 'light' | 'dark' = pref === 'system' ? (sys === 'dark' ? 'dark' : 'light') : pref;
  applyScheme(scheme);
  const setPref = (p: Pref) => { setPrefState(p); void AsyncStorage.setItem('themePref', p); };
  return <Ctx.Provider value={{ pref, setPref, scheme }}>{children(scheme)}</Ctx.Provider>;
}
