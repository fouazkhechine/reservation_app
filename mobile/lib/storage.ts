import { Platform } from "react-native";

type WebStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

declare const require: (name: string) => unknown;

function webStorage(): WebStorage | null {
  if (Platform.OS !== "web") return null;
  return (globalThis as unknown as { localStorage?: WebStorage }).localStorage ?? null;
}

function secureStore(): SecureStoreLike {
  return require("expo-secure-store") as SecureStoreLike;
}

export const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") return webStorage()?.getItem(key) ?? null;
    return secureStore().getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      webStorage()?.setItem(key, value);
      return;
    }
    await secureStore().setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") {
      webStorage()?.removeItem(key);
      return;
    }
    await secureStore().deleteItemAsync(key);
  },
};
