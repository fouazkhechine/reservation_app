import { Platform } from "react-native";
import * as Application from "expo-application";
import { storage } from "./storage";

const DEVICE_KEY = "mahdi.device.id";
let cached: string | null = null;

function fallbackId(): string {
  return `dev-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

async function platformId(): Promise<string | null> {
  try {
    if (Platform.OS === "android") return Application.getAndroidId();
    if (Platform.OS === "ios") return await Application.getIosIdForVendorAsync();
  } catch {
    return null;
  }
  return null;
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const nativeId = await platformId();
  if (nativeId) {
    cached = nativeId;
    return nativeId;
  }
  const saved = await storage.get(DEVICE_KEY).catch(() => null);
  if (saved) {
    cached = saved;
    return saved;
  }
  const generated = fallbackId();
  await storage.set(DEVICE_KEY, generated).catch(() => undefined);
  cached = generated;
  return generated;
}
