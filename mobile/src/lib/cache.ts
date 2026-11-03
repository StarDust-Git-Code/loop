import AsyncStorage from '@react-native-async-storage/async-storage';
const P = 'cache:';
export const cacheGet = async <T,>(k: string): Promise<T | null> => { try { const v = await AsyncStorage.getItem(P + k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
export const cacheSet = (k: string, v: unknown) => { AsyncStorage.setItem(P + k, JSON.stringify(v)).catch(() => undefined); };
export const cacheClear = async () => { try { const ks = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(P)); await AsyncStorage.multiRemove(ks); } catch { /* nothing cached */ } };
