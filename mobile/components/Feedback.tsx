import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../lib/theme";

function usePulse(minOpacity = 0.35): Animated.Value {
  const value = useRef(new Animated.Value(minOpacity)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: minOpacity,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [minOpacity, value]);
  return value;
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = usePulse();
  return <Animated.View style={[styles.skeleton, style, { opacity }]} />;
}

export function SkeletonRows({
  count = 3,
  height = 88,
  radius = 10,
}: {
  count?: number;
  height?: number;
  radius?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          style={{ height, borderRadius: radius, marginBottom: 10 }}
        />
      ))}
    </>
  );
}

function BouncingDot({ delay }: { delay: number }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(240 - delay),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, value]);
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
          transform: [
            { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
          ],
        },
      ]}
    />
  );
}

export function LoadingLabel({ label = "Chargement en cours" }: { label?: string }) {
  return (
    <View style={styles.loadingRow}>
      <View style={styles.dots}>
        <BouncingDot delay={0} />
        <BouncingDot delay={80} />
        <BouncingDot delay={160} />
      </View>
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.centerFill}>
      <View style={styles.pulseRing}>
        <Ionicons name="cut" size={22} color={C.gold} />
      </View>
      <LoadingLabel label={label} />
    </View>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerIcon}>
        <Ionicons name="alert-circle-outline" size={18} color={C.danger} />
      </View>
      <View style={styles.bannerBody}>
        <Text style={styles.bannerTitle}>Une erreur est survenue</Text>
        <Text style={styles.bannerMessage}>{message}</Text>
      </View>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.bannerAction} hitSlop={8}>
          <Text style={styles.bannerActionText}>RÉESSAYER</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <View style={[styles.banner, styles.successBanner]}>
      <View style={[styles.bannerIcon, styles.successIcon]}>
        <Ionicons name="checkmark-circle-outline" size={18} color={C.success} />
      </View>
      <Text style={[styles.bannerMessage, styles.successMessage]}>{message}</Text>
    </View>
  );
}

export function Toast({
  message,
  tone = "success",
  onDone,
}: {
  message: string;
  tone?: "success" | "error";
  onDone: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => doneRef.current());
    }, 2400);
    return () => clearTimeout(timer);
  }, [message, progress]);
  const tint = tone === "success" ? C.success : C.danger;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        tone === "error" && styles.toastError,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
            },
          ],
        },
      ]}
    >
      <Ionicons
        name={tone === "success" ? "checkmark-circle" : "alert-circle"}
        size={18}
        color={tint}
      />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

export function ErrorState({
  title = "Connexion impossible",
  message,
  onRetry,
  children,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={styles.centerFill}>
      <View style={styles.errorSeal}>
        <Ionicons name="cloud-offline-outline" size={26} color={C.danger} />
      </View>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Ionicons name="refresh" size={15} color={C.gold} />
          <Text style={styles.retryText}>RÉESSAYER</Text>
        </Pressable>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: "#1f1f1f" },
  loadingRow: { alignItems: "center", gap: 12 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold },
  loadingLabel: {
    color: C.muted,
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 40,
    gap: 10,
  },
  pulseRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: "rgba(201,164,92,.35)",
    backgroundColor: C.goldSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(216,137,128,.35)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  successBanner: {
    backgroundColor: C.successSoft,
    borderColor: "rgba(111,156,117,.35)",
  },
  bannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,137,128,.12)",
  },
  successIcon: { backgroundColor: "rgba(111,156,117,.14)" },
  bannerBody: { flex: 1, gap: 2 },
  bannerTitle: { color: C.text, fontSize: 11, fontWeight: "700" },
  bannerMessage: { color: C.danger, fontSize: 11, lineHeight: 16, flex: 1 },
  successMessage: { color: C.success },
  bannerAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(201,164,92,.5)",
  },
  bannerActionText: { color: C.gold, fontSize: 8, letterSpacing: 1, fontWeight: "800" },
  errorSeal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(216,137,128,.35)",
    backgroundColor: C.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: { color: C.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  errorMessage: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 300,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.gold,
  },
  retryText: { color: C.gold, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  toast: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(111,156,117,.45)",
    backgroundColor: "#16201b",
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastError: {
    borderColor: "rgba(216,137,128,.45)",
    backgroundColor: "#241715",
  },
  toastText: { color: C.text, fontSize: 12, flex: 1, lineHeight: 17 },
});
