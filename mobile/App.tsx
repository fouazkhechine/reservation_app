import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api, type Service } from "./lib/api";
import { getDeviceId } from "./lib/device";
import { subscribeRealtime, type RealtimeEvent } from "./lib/realtime";
import { storage } from "./lib/storage";
import { C, money } from "./lib/theme";
import {
  ErrorBanner,
  ErrorState,
  LoadingLabel,
  Skeleton,
  SkeletonRows,
  Toast,
} from "./components/Feedback";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

type Role = "client" | "admin";
type Screen = "home" | "services" | "schedule" | "details" | "summary" | "success" | "bookings";
type AdminView = "overview" | "reservations" | "calendar" | "services" | "notifications";

const photos = {
  hero: "https://images.unsplash.com/photo-1635346125627-74d1b2867898?auto=format&fit=crop&w=1000&q=85",
  cut: "https://images.unsplash.com/photo-1635346087012-50cffbeb575f?auto=format&fit=crop&w=600&q=85",
  portrait: "https://images.unsplash.com/photo-1790575546981-3ed726a823f1?auto=format&fit=crop&w=600&q=85",
  beard: "https://images.unsplash.com/photo-1788627720467-a7a751bcd9de?auto=format&fit=crop&w=600&q=85",
};

const phonePattern = /^(?:\+213|0)[567]\d{8}$/;
const statusLabels: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  REJECTED: "Refusée",
};
const statusLabel = (status?: string) => (status ? statusLabels[status] ?? status : "—");
const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const notificationStatus = (status: string) => {
  if (status === "SENT") return { label: "Envoyée", color: C.success, icon: "notifications" as const };
  if (status === "FAILED") return { label: "Échec d'envoi", color: C.danger, icon: "alert-circle" as const };
  if (status === "SKIPPED") return { label: "Non envoyée · aucun appareil enregistré", color: C.muted, icon: "notifications-off-outline" as const };
  return { label: "En attente", color: C.gold, icon: "time-outline" as const };
};

async function registerForPushNotificationsAsync(): Promise<"registered" | "unsupported"> {
  if (!Device.isDevice || Platform.OS === "web") return "unsupported";
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("mahdi-bookings", { name: "Réservations", importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: C.gold });
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Permission de notification refusée");
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) throw new Error("Projet EAS non configuré (EXPO_PUBLIC_EAS_PROJECT_ID manquant)");
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api.registerDevice(token, Platform.OS === "android" ? "android" : "ios");
  return "registered";
}

function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setServices(await api.services());
    } catch (e) {
      setError(message(e, "Impossible de charger les services"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { services, loading, error, reload: load };
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[s.brand, compact && s.brandCompact]}>
      <View style={compact ? s.brandMarkSmall : s.brandMark}>
        <Ionicons name="cut" size={compact ? 18 : 32} color={C.gold} />
      </View>
      <View>
        <Text style={[s.brandName, compact && s.brandNameSmall]}>MAHDI</Text>
        <Text style={s.brandSub}>BARBER · ALGER</Text>
      </View>
    </View>
  );
}

function GoldButton({ label, onPress, outline, disabled, loading }: {
  label: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [s.goldButton, outline && s.outline, (disabled || loading) && s.disabled, pressed && s.pressed]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={outline ? C.gold : "#17130d"} />
      ) : (
        <Text style={[s.goldButtonText, outline && { color: C.gold }]}>{label}</Text>
      )}
    </Pressable>
  );
}

function TopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={s.topBar}>
      <Pressable onPress={onBack} style={s.iconButton} disabled={!onBack}>
        {onBack ? <Ionicons name="chevron-back" size={22} color={C.text} /> : null}
      </Pressable>
      <Text style={s.topTitle}>{title}</Text>
      <View style={s.iconButton} />
    </View>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <View style={s.progress}>
      {[0, 1, 2, 3].map((n) => (
        <View key={n} style={[s.progressDot, n <= step && s.progressDotActive]} />
      ))}
    </View>
  );
}

function HomeSkeleton() {
  return (
    <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
      <View style={s.homeHeader}>
        <Skeleton style={{ width: 116, height: 34, borderRadius: 17 }} />
        <Skeleton style={{ width: 40, height: 40, borderRadius: 20 }} />
      </View>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <Skeleton style={{ height: 390, borderRadius: 18 }} />
        <Skeleton style={{ width: 110, height: 9, borderRadius: 4, marginTop: 10 }} />
        <Skeleton style={{ width: 190, height: 20, borderRadius: 6 }} />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
          <Skeleton style={{ width: 150, height: 198, borderRadius: 12 }} />
          <Skeleton style={{ width: 150, height: 198, borderRadius: 12 }} />
        </View>
        <Skeleton style={{ height: 86, borderRadius: 12, marginTop: 10 }} />
      </View>
      <View style={s.skeletonFooter}>
        <LoadingLabel label="Chargement des services" />
      </View>
    </SafeAreaView>
  );
}

function ServicesSkeleton() {
  return (
    <View>
      <Skeleton style={{ width: 90, height: 9, borderRadius: 4 }} />
      <Skeleton style={{ width: 230, height: 26, borderRadius: 6, marginTop: 10, marginBottom: 22 }} />
      <SkeletonRows count={4} height={108} />
    </View>
  );
}

function SlotSkeletons() {
  return (
    <View style={s.slots}>
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} style={{ width: "23%", height: 44, borderRadius: 6 }} />
      ))}
    </View>
  );
}

function EmptyState({ icon, title, note }: { icon: keyof typeof Ionicons.glyphMap; title: string; note?: string }) {
  return (
    <View style={s.emptyState}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={24} color={C.gold} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {note ? <Text style={s.emptyText}>{note}</Text> : null}
    </View>
  );
}

function ClientApp({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(0);
  const [time, setTime] = useState("");
  const dateValues = Array.from({ length: 5 }, (_, index) => { const value = new Date(); value.setDate(value.getDate() + index + 1); return value; });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [slotToast, setSlotToast] = useState("");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", commune: "Hydra", address: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deviceId, setDeviceId] = useState("");
  useEffect(() => { getDeviceId().then(setDeviceId).catch(() => undefined); }, []);
  useEffect(() => {
    storage.get("mahdi.customer.phone").then((saved) => {
      if (saved) setForm((current) => current.phone ? current : { ...current, phone: saved });
    }).catch(() => undefined);
  }, []);
  const { services, loading: servicesLoading, error: servicesError, reload: reloadServices } = useServices();
  useEffect(() => {
    setSelected((current) => {
      const valid = current.filter((id) => services.some((service) => service.id === id));
      return valid.length === current.length ? current : valid;
    });
  }, [services]);
  useEffect(() => { if (!selected.length && services.length) setSelected([services[0].id]); }, [services, selected.length]);
  const chosen = services.filter((service) => selected.includes(service.id));
  const total = chosen.reduce((sum, service) => sum + service.price, 0);
  const duration = chosen.reduce((sum, service) => sum + service.duration, 0);
  const [bookingError, setBookingError] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingReference, setBookingReference] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  const loadAvailability = useCallback(async () => {
    if (!duration) {
      setAvailableSlots([]);
      setTakenSlots([]);
      setAvailabilityError("");
      return;
    }
    setAvailabilityLoading(true);
    setAvailabilityError("");
    setAvailableSlots([]);
    setTakenSlots([]);
    setTime("");
    try {
      const result = await api.availability(dateValues[date].toISOString().slice(0, 10), duration);
      setAvailableSlots(result.slots);
      setTakenSlots(result.taken ?? []);
      setTime(result.slots[0] ?? "");
    } catch (e) {
      setAvailabilityError(message(e, "Impossible de charger les créneaux"));
    } finally {
      setAvailabilityLoading(false);
    }
  }, [date, duration]);

  useEffect(() => { if (screen === "schedule") loadAvailability(); }, [screen, loadAvailability]);

  const loadBookings = useCallback(async () => {
    const phone = form.phone.trim();
    const device = deviceId;
    if (!phone && !device) {
      setCustomerBookings([]);
      setBookingsError("");
      return;
    }
    setBookingsLoading(true);
    setBookingsError("");
    try {
      setCustomerBookings(await api.bookings({ phone: phone || undefined, deviceId: device || undefined }));
    } catch (e) {
      setBookingsError(message(e, "Impossible de charger les réservations"));
    } finally {
      setBookingsLoading(false);
    }
  }, [form.phone, deviceId]);

  useEffect(() => { if (screen === "bookings") loadBookings(); }, [screen, loadBookings]);

  const realtimeRef = useRef<(event: RealtimeEvent) => void>(() => undefined);
  realtimeRef.current = (event) => {
    if (event.type === "services") reloadServices();
    if (event.type === "bookings" && screen === "bookings") loadBookings();
    if (screen === "schedule") loadAvailability();
  };
  useEffect(() => subscribeRealtime((event) => realtimeRef.current(event)), []);

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "phone") storage.set("mahdi.customer.phone", value).catch(() => undefined);
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateDetails = () => {
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = "Saisissez votre nom complet.";
    if (!phonePattern.test(form.phone.replace(/\s/g, ""))) errors.phone = "Numéro algérien invalide (ex. 0550 00 00 00).";
    if (form.commune.trim().length < 2) errors.commune = "Saisissez votre commune.";
    if (form.address.trim().length < 5) errors.address = "Saisissez une adresse d’au moins 5 caractères.";
    setFieldErrors(errors);
    if (!Object.keys(errors).length) {
      setBookingError("");
      setScreen("summary");
    }
  };

  const submitBooking = async () => {
    if (bookingSubmitting) return;
    const selectedSlot = availableSlots.find((slot) => slot.slice(11, 16) === time);
    if (!time) {
      setBookingError(availabilityLoading ? "Les créneaux sont encore en cours de chargement." : "Sélectionnez un créneau disponible.");
      return;
    }
    if (!selectedSlot) {
      setBookingError("Ce créneau n’est plus disponible. Actualisez les créneaux pour en choisir un autre.");
      return;
    }
    setBookingError("");
    setBookingSubmitting(true);
    try {
      const result = await api.createBooking({
        serviceIds: selected,
        startAt: selectedSlot,
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        wilaya: "Alger",
        commune: form.commune.trim(),
        address: form.address.trim(),
        deviceId: deviceId || undefined,
      });
      setBookingReference(result.bookingReference);
      setBookingStatus(result.status);
      setScreen("success");
    } catch (e) {
      setBookingError(message(e, "Impossible de confirmer la réservation"));
    } finally {
      setBookingSubmitting(false);
    }
  };

  const back: Partial<Record<Screen, Screen>> = {
    services: "home",
    schedule: "services",
    details: "schedule",
    summary: "details",
    bookings: "home",
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "home") return false;
      if (screen === "success") {
        setScreen("bookings");
        return true;
      }
      setScreen(back[screen] ?? "home");
      return true;
    });
    return () => subscription.remove();
  }, [screen]);

  if (servicesLoading && !services.length) return <HomeSkeleton />;

  if (servicesError && !services.length) {
    return (
      <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
        <View style={s.homeHeader}>
          <Brand compact />
          <Pressable onPress={onOpenAdmin} style={s.avatar}>
            <Ionicons name="person" size={18} color={C.gold} />
          </Pressable>
        </View>
        <ErrorState key="services-error" title="Services indisponibles" message={servicesError} onRetry={reloadServices} />
      </SafeAreaView>
    );
  }

  if (screen === "home") {
    return (
      <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.homeHeader}>
            <Brand compact />
            <Pressable onPress={onOpenAdmin} style={s.avatar}>
              <Ionicons name="person" size={18} color={C.gold} />
            </Pressable>
          </View>
          <View style={s.hero}>
            <Image source={{ uri: photos.hero }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={["transparent", "rgba(16,16,16,.97)"]} style={StyleSheet.absoluteFill} />
            <View style={s.heroCopy}>
              <Text style={s.eyebrow}>SERVICE À DOMICILE · ALGER</Text>
              <Text style={s.heroTitle}>Votre style,{"\n"}<Text style={s.goldSerif}>chez vous.</Text></Text>
              <GoldButton label="RÉSERVER MAINTENANT" onPress={() => setScreen("services")} />
            </View>
          </View>
          <View style={s.homeBody}>
            <Text style={s.eyebrow}>NOS SIGNATURES</Text>
            <Text style={s.sectionTitle}>Services populaires</Text>
            {services.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {services.slice(0, 3).map((service) => (
                  <Pressable key={service.id} style={s.popularCard} onPress={() => setScreen("services")}>
                    <Image source={{ uri: service.image }} style={s.popularImage} />
                    <Text style={s.cardTitle}>{service.name}</Text>
                    <Text style={s.cardPrice}>{money(service.price)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <EmptyState icon="cut-outline" title="Aucun service disponible" note="Revenez un peu plus tard." />
            )}
            <Pressable style={s.availability} onPress={() => setScreen("schedule")}>
              <View style={s.availabilityIcon}><Ionicons name="time" size={22} color={C.gold} /></View>
              <View style={{ flex: 1 }}><Text style={s.eyebrow}>DISPONIBILITÉ</Text><Text style={s.availabilityTitle}>Choisir un créneau</Text></View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </Pressable>
          </View>
        </ScrollView>
        <View style={[s.bottomNav, { height: 74 + insets.bottom, paddingBottom: insets.bottom }]}>
          <Pressable style={s.navItem}><Ionicons name="home" size={20} color={C.gold} /><Text style={[s.navText, { color: C.gold }]}>Accueil</Text></Pressable>
          <Pressable style={s.navItem} onPress={() => setScreen("bookings")}><Ionicons name="calendar-outline" size={20} color={C.muted} /><Text style={s.navText}>Réservations</Text></Pressable>
          <Pressable style={s.navItem} onPress={onOpenAdmin}><Ionicons name="person-outline" size={20} color={C.muted} /><Text style={s.navText}>Espace pro</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "services") {
    return (
      <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
        <TopBar title="Choisir vos services" onBack={() => setScreen(back[screen] ?? "home")} />
        <Progress step={0} />
        <ScrollView contentContainerStyle={[s.screenContent, { paddingBottom: 110 + insets.bottom }]}>
          <Text style={s.eyebrow}>ÉTAPE 01</Text>
          <Text style={s.screenTitle}>À quoi avez-vous{"\n"}<Text style={s.goldSerif}>envie aujourd’hui ?</Text></Text>
          {servicesLoading ? <ServicesSkeleton /> : services.length ? services.map((service) => {
            const active = selected.includes(service.id);
            return (
              <Pressable key={service.id} onPress={() => setSelected((cur) => active ? cur.filter((id) => id !== service.id) : [...cur, service.id])} style={[s.serviceRow, active && s.serviceRowActive]}>
                <Image source={{ uri: service.image }} style={s.serviceImage} />
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text style={s.cardTitle}>{service.name}</Text>
                  <Text style={s.serviceDesc}>{service.desc}</Text>
                  <Text style={s.serviceDuration}>{service.duration} min</Text>
                </View>
                <View style={{ alignItems: "flex-end", paddingRight: 12, gap: 12 }}>
                  <Text style={s.cardPrice}>{money(service.price)}</Text>
                  <View style={[s.check, active && s.checkActive]}>{active && <Ionicons name="checkmark" size={13} color="#111" />}</View>
                </View>
              </Pressable>
            );
          }) : <EmptyState icon="cut-outline" title="Aucun service disponible" note="Réessayez dans un instant." />}
        </ScrollView>
        <View style={[s.actionBar, { height: 88 + insets.bottom, paddingBottom: insets.bottom }]}>
          <View><Text style={s.actionMeta}>{chosen.length} service(s) · {duration} min</Text><Text style={s.actionTotal}>{money(total)}</Text></View>
          <GoldButton label="CONTINUER" disabled={!chosen.length} onPress={() => setScreen("schedule")} />
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "schedule") {
    const entries = [
      ...availableSlots.map((value) => ({ time: value.slice(11, 16), taken: false })),
      ...takenSlots.map((value) => ({ time: value.slice(11, 16), taken: true })),
    ].sort((a, b) => a.time.localeCompare(b.time));
    const month = dateValues[date].toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
    return (
      <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
        <TopBar title="Choisir un créneau" onBack={() => setScreen("services")} />
        <Progress step={1} />
        <ScrollView contentContainerStyle={[s.screenContent, { paddingBottom: 110 + insets.bottom }]}>
          <Text style={s.eyebrow}>ÉTAPE 02</Text>
          <Text style={s.screenTitle}>Quand souhaitez-vous{"\n"}<Text style={s.goldSerif}>être reçu ?</Text></Text>
          <Text style={s.monthTitle}>{month}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dateValues.map((value, i) => {
              const weekday = value.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
              return (
                <Pressable key={`${value.toISOString()}-${i}`} onPress={() => setDate(i)} style={[s.dateCard, date === i && s.dateCardActive]}>
                  <Text style={[s.dateWeekday, date === i && { color: C.bg }]}>{weekday}</Text>
                  <Text style={[s.dateNumber, date === i && { color: C.bg }]}>{value.getDate()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>Créneaux disponibles</Text>
          {availabilityLoading ? (
            <SlotSkeletons />
          ) : availabilityError ? (
            <ErrorBanner message={availabilityError} onRetry={loadAvailability} />
          ) : entries.length ? (
            <>
              <View style={s.slots}>
                {entries.map((slot) => (
                  <Pressable
                    key={`${slot.time}-${slot.taken ? "t" : "f"}`}
                    onPress={() => slot.taken ? setSlotToast("Ce créneau est déjà réservé. Choisissez un autre horaire.") : setTime(slot.time)}
                    style={[s.slot, slot.taken && s.slotBlocked, !slot.taken && time === slot.time && s.slotActive]}
                  >
                    <Text style={[s.slotText, slot.taken && s.slotTakenText, !slot.taken && time === slot.time && { color: C.bg }]}>{slot.time}</Text>
                    {slot.taken ? <Text style={s.slotTakenLabel}>Réservé</Text> : null}
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={loadAvailability} style={s.inlineRetry}>
                <Ionicons name="refresh" size={14} color={C.gold} />
                <Text style={s.retryText}>ACTUALISER LES CRÉNEAUX</Text>
              </Pressable>
            </>
          ) : (
            <View>
              <EmptyState icon="calendar-outline" title="Aucun créneau disponible" note="Essayez une autre date ou réduisez la durée." />
              <Pressable onPress={loadAvailability} style={s.inlineRetry}>
                <Ionicons name="refresh" size={14} color={C.gold} />
                <Text style={s.retryText}>ACTUALISER</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
        <View style={[s.actionBar, { height: 88 + insets.bottom, paddingBottom: insets.bottom }]}>
          <View style={{ flex: 1, paddingRight: 12 }}><Text style={s.actionMeta}>{time ? `Créneau sélectionné · ${time}` : "Aucun créneau sélectionné"}</Text><Text style={s.actionTotal}>{money(total)}</Text></View>
          <GoldButton label="CONTINUER" disabled={!time || availabilityLoading} onPress={() => setScreen("details")} />
        </View>
        {slotToast ? <Toast message={slotToast} tone="error" onDone={() => setSlotToast("")} /> : null}
      </SafeAreaView>
    );
  }

  if (screen === "details") {
    return (
      <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
        <TopBar title="Vos coordonnées" onBack={() => setScreen("schedule")} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Progress step={2} />
          <ScrollView contentContainerStyle={[s.screenContent, { paddingBottom: 120 + insets.bottom }]} keyboardShouldPersistTaps="handled">
            <Text style={s.eyebrow}>ÉTAPE 03</Text>
            <Text style={s.screenTitle}>Où nous{"\n"}<Text style={s.goldSerif}>retrouver ?</Text></Text>
            {(["name", "phone", "commune", "address"] as const).map((field) => (
              <View key={field} style={s.fieldBlock}>
                <Text style={s.fieldLabel}>{field === "name" ? "Nom complet" : field === "phone" ? "Téléphone" : field === "commune" ? "Commune" : "Adresse"}</Text>
                <TextInput
                  value={form[field]}
                  onChangeText={(value) => setField(field, value)}
                  style={[s.input, fieldErrors[field] && s.inputError]}
                  keyboardType={field === "phone" ? "phone-pad" : "default"}
                  placeholder={field === "phone" ? "0550 00 00 00" : field === "address" ? "N°, rue, résidence…" : undefined}
                  placeholderTextColor="#777"
                />
                {fieldErrors[field] ? (
                  <View style={s.fieldErrorRow}>
                    <Ionicons name="alert-circle" size={13} color={C.danger} />
                    <Text style={s.fieldError}>{fieldErrors[field]}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
        <View style={[s.actionBarFull, { height: 88 + insets.bottom, paddingBottom: 16 + insets.bottom }]}>
          <GoldButton label="VOIR LE RÉSUMÉ" onPress={validateDetails} />
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "summary") {
    return (
      <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
        <TopBar title="Votre réservation" onBack={() => setScreen("details")} />
        <Progress step={3} />
        <ScrollView contentContainerStyle={[s.screenContent, { paddingBottom: 120 + insets.bottom }]}>
          <Text style={s.eyebrow}>DERNIÈRE ÉTAPE</Text><Text style={s.screenTitle}>Récapitulatif</Text>
          <View style={s.summaryCard}><Text style={s.eyebrow}>RENDEZ-VOUS</Text><Text style={s.summaryDate}>{dateValues[date].toLocaleDateString("fr-FR")} · {time || "Aucun créneau"}</Text><Text style={s.summaryMuted}>{duration} minutes</Text></View>
          <View style={s.summaryCard}><Text style={s.eyebrow}>SERVICES</Text>{chosen.map((service) => <View key={service.id} style={s.summaryLine}><Text style={s.summaryText}>{service.name}</Text><Text style={s.summaryText}>{money(service.price)}</Text></View>)}<View style={s.summaryTotal}><Text style={s.summaryMuted}>TOTAL</Text><Text style={s.summaryTotalValue}>{money(total)}</Text></View></View>
          <View style={s.summaryCard}><Text style={s.eyebrow}>ADRESSE & CONTACT</Text><Text style={s.summaryText}>{form.name}</Text><Text style={s.summaryMuted}>{form.phone}</Text><Text style={s.summaryMuted}>{form.address}, {form.commune}</Text></View>
          {bookingError ? <ErrorBanner message={bookingError} /> : null}
          {bookingError ? (
            <Pressable
              onPress={() => { setBookingError(""); setTime(""); setScreen("schedule"); }}
              style={s.inlineRetry}
            >
              <Ionicons name="time-outline" size={14} color={C.gold} />
              <Text style={s.retryText}>CHOISIR UN AUTRE CRÉNEAU</Text>
            </Pressable>
          ) : null}
        </ScrollView>
        <View style={[s.actionBarFull, { height: 88 + insets.bottom, paddingBottom: 16 + insets.bottom }]}>
          <GoldButton label="CONFIRMER LA RÉSERVATION" loading={bookingSubmitting} onPress={submitBooking} />
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "success") {
    return (
      <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={s.successContent}>
          <View style={s.success}>
            <View style={s.successSeal}><Ionicons name="checkmark" size={42} color={C.gold} /></View>
            <Text style={s.eyebrow}>RÉSERVATION REÇUE</Text>
            <Text style={s.successTitle}>Demande enregistrée</Text>
            <View style={s.ticket}><Text style={s.ticketTitle}>MAHDI</Text><Text style={s.summaryDate}>Référence {bookingReference}</Text><Text style={s.summaryMuted}>Statut : {statusLabel(bookingStatus)}</Text><Text style={s.summaryMuted}>{chosen.map((x) => x.name).join(" + ")}</Text></View>
            <Text style={s.successNote}>Votre demande sera confirmée par le barber.</Text>
            <GoldButton label="VOIR MES RÉSERVATIONS" onPress={() => setScreen("bookings")} />
            <Pressable onPress={() => setScreen("home")}><Text style={s.textButton}>Retour à l’accueil</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
      <TopBar title="Mes réservations" onBack={() => setScreen("home")} />
      <ScrollView contentContainerStyle={[s.screenContent, { paddingBottom: 110 + insets.bottom }]}>
        <Text style={s.eyebrow}>VOTRE HISTORIQUE</Text><Text style={s.screenTitle}>Réservations</Text>
        {bookingsLoading ? (
          <SkeletonRows count={3} height={92} />
        ) : bookingsError ? (
          <ErrorBanner message={bookingsError} onRetry={loadBookings} />
        ) : customerBookings.length ? (
          customerBookings.map((booking) => (
            <View key={booking.id} style={s.bookingCard}>
              <View style={s.dateBlock}>
                <Text style={s.dateBlockText}>{new Date(booking.startAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).toUpperCase()}</Text>
                <Text style={s.dateBlockTime}>{new Date(booking.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
              <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={s.bookingStatus}>{statusLabel(booking.status)}</Text>
                <Text style={s.cardTitle} numberOfLines={1}>{booking.bookingReference ? `Réservation ${booking.bookingReference}` : "Réservation"}</Text>
              </View>
              <Text style={s.cardPrice}>{money(booking.totalPrice ?? 0)}</Text>
            </View>
          ))
        ) : (
          <>
            <EmptyState
              icon="calendar-clear-outline"
              title={form.phone.trim() ? "Aucune réservation" : "Vos réservations apparaîtront ici"}
              note={form.phone.trim() ? "Réservez un service pour commencer." : "Vos réservations sont liées à cet appareil."}
            />
            {!form.phone.trim() ? (
              <View style={s.recoverCard}>
                <Text style={s.fieldLabel}>Retrouver mes réservations</Text>
                <TextInput
                  value={form.phone}
                  onChangeText={(value) => setField("phone", value)}
                  placeholder="0550 00 00 00"
                  placeholderTextColor="#777"
                  keyboardType="phone-pad"
                  style={s.input}
                />
                <View style={{ height: 10 }} />
                <GoldButton label="RECHERCHER" onPress={loadBookings} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={[s.actionBarFull, { height: 88 + insets.bottom, paddingBottom: 16 + insets.bottom }]}>
        <GoldButton label="NOUVELLE RÉSERVATION" onPress={() => setScreen("services")} />
      </View>
    </SafeAreaView>
  );
}

function AdminSkeleton() {
  return (
    <>
      <View style={s.adminHeader}>
        <View>
          <Skeleton style={{ width: 118, height: 9, borderRadius: 4 }} />
          <Skeleton style={{ width: 140, height: 24, borderRadius: 6, marginTop: 8 }} />
        </View>
        <Skeleton style={{ width: 40, height: 40, borderRadius: 20 }} />
      </View>
      <ScrollView contentContainerStyle={s.adminContent}>
        <LoadingLabel label="Chargement de l'espace pro" />
        <View style={[s.statsGrid, { marginTop: 22 }]}>
          {[0, 1, 2].map((index) => <Skeleton key={index} style={{ flex: 1, height: 118, borderRadius: 10 }} />)}
        </View>
        <Skeleton style={{ height: 190, borderRadius: 10, marginTop: 14 }} />
        <SkeletonRows count={2} height={66} radius={10} />
      </ScrollView>
    </>
  );
}

function AdminApp({ onLogout }: { onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<AdminView>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pushStatus, setPushStatus] = useState("");
  const [dashboard, setDashboard] = useState<Record<string, number> | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hours, setHours] = useState<any[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [blockedDate, setBlockedDate] = useState("");
  const [blockedStart, setBlockedStart] = useState("09:00");
  const [blockedEnd, setBlockedEnd] = useState("18:00");
  const [blockedReason, setBlockedReason] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");

  const refresh = async () => {
    setLoading(true); setError("");
    try {
      const [stats, bookingRows, serviceRows, hourRows, blockedRows, notificationRows] = await Promise.all([
        api.dashboard(), api.adminBookings(), api.adminServices(), api.workingHours(), api.blockedSlots(), api.adminNotifications(),
      ]);
      setDashboard(stats); setBookings(bookingRows); setServices(serviceRows as any[]); setHours(hourRows as any[]); setBlockedSlots(blockedRows as any[]); setNotifications(notificationRows);
    } catch (e) { setError(message(e, "Impossible de charger l’espace professionnel")); }
    finally { setLoading(false); }
  };

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedBooking?.id ?? null;

  const loadBookingsFeed = useCallback(async () => {
    try {
      const [stats, bookingRows, notificationRows] = await Promise.all([api.dashboard(), api.adminBookings(), api.adminNotifications()]);
      setDashboard(stats); setBookings(bookingRows); setNotifications(notificationRows);
      const openId = selectedIdRef.current;
      if (openId) {
        try { setSelectedBooking(await api.bookingDetail(openId)); } catch { /* keep current detail */ }
      }
    } catch {
      // keep the last known data when a background refresh fails
    }
  }, []);
  const loadServicesFeed = useCallback(async () => {
    try { setServices(await api.adminServices()); } catch { /* keep last data */ }
  }, []);
  const loadCalendarFeed = useCallback(async () => {
    try {
      const [hourRows, blockedRows] = await Promise.all([api.workingHours(), api.blockedSlots()]);
      setHours(hourRows as any[]); setBlockedSlots(blockedRows as any[]);
    } catch { /* keep last data */ }
  }, []);

  const adminRealtimeRef = useRef<(event: RealtimeEvent) => void>(() => undefined);
  adminRealtimeRef.current = (event) => {
    if (event.type === "bookings") loadBookingsFeed();
    else if (event.type === "services") loadServicesFeed();
    else loadCalendarFeed();
  };
  useEffect(() => subscribeRealtime((event) => adminRealtimeRef.current(event)), []);

  useEffect(() => {
    refresh();
    registerForPushNotificationsAsync()
      .then((result) => setPushStatus(result === "registered" ? "Notifications push activées sur cet appareil." : "Push indisponible sur cet appareil (émulateur ou navigateur)."))
      .catch((e) => setPushStatus(`${message(e, "Notifications push indisponibles")} · les alertes restent visibles ici.`));
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedBooking) {
        setSelectedBooking(null);
        return true;
      }
      if (view !== "overview") {
        setView("overview");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [selectedBooking, view]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true); setError(""); setToast("");
    try { await action(); setToast(success); await refresh(); }
    catch (e) { setError(message(e, "Opération impossible")); }
    finally { setSaving(false); }
  };
  const updateStatus = async (id: string, status: string) => {
    setSaving(true); setError(""); setToast("");
    try {
      await api.updateBookingStatus(id, status);
      setToast(status === "CONFIRMED" ? "Réservation confirmée définitivement" : "Réservation annulée · créneau libéré");
      await refresh();
      try { setSelectedBooking(await api.bookingDetail(id)); }
      catch { setSelectedBooking((current: any) => current ? { ...current, status } : current); }
    } catch (e) { setError(message(e, "Opération impossible")); }
    finally { setSaving(false); }
  };
  const openBooking = async (item: any) => { setSelectedBooking(item); setDetailLoading(true); setError(""); try { setSelectedBooking(await api.bookingDetail(item.id)); } catch (e) { setError(message(e, "Impossible de charger le détail")); } finally { setDetailLoading(false); } };
  const openEditor = (service: any) => {
    setEditing(service);
    setEditName(service.name);
    setEditPrice(String(service.priceDzd));
    setEditDuration(String(service.durationMinutes));
    setEditDescription(service.description ?? "");
    setEditError("");
  };
  const saveEditor = () => {
    if (!editing) return;
    const price = Number(editPrice.replace(/[^\d]/g, ""));
    const duration = Number(editDuration);
    if (editName.trim().length < 2) { setEditError("Le nom doit contenir au moins 2 caractères."); return; }
    if (!Number.isInteger(price) || price < 0) { setEditError("Saisissez un prix valide en DZD."); return; }
    if (!Number.isInteger(duration) || duration < 1 || duration > 480) { setEditError("La durée doit être comprise entre 1 et 480 minutes."); return; }
    setEditing(null);
    setEditError("");
    run(() => api.updateService(editing.id, { name: editName.trim(), description: editDescription.trim(), priceDzd: price, durationMinutes: duration }), "Service mis à jour · clients actualisés");
  };
  const saveHours = () => run(() => api.updateWorkingHours(hours.map((item) => ({ dayOfWeek: item.dayOfWeek, openingTime: String(item.openingTime).slice(0, 5), closingTime: String(item.closingTime).slice(0, 5), isOpen: item.isOpen }))), "Horaires enregistrés");
  const addBlocked = () => {
    if (!blockedDate) { setError("Sélectionnez une date"); return; }
    run(() => api.addBlockedSlot({ startAt: `${blockedDate}T${blockedStart}:00.000Z`, endAt: `${blockedDate}T${blockedEnd}:00.000Z`, reason: blockedReason || "Indisponibilité" }), "Créneau bloqué");
  };
  const blockFullDay = () => {
    if (!blockedDate) { setError("Sélectionnez une date"); return; }
    run(() => api.addBlockedSlot({ startAt: `${blockedDate}T00:00:00.000Z`, endAt: `${blockedDate}T23:59:59.000Z`, reason: "Journée bloquée" }), "Journée bloquée");
  };
  const items = [
    { id: "overview" as const, label: "Accueil", icon: "grid-outline" as const },
    { id: "reservations" as const, label: "RDV", icon: "calendar-outline" as const },
    { id: "calendar" as const, label: "Horaires", icon: "today-outline" as const },
    { id: "services" as const, label: "Services", icon: "cut-outline" as const },
    { id: "notifications" as const, label: "Alertes", icon: "notifications-outline" as const },
  ];
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  if (loading && !dashboard) {
    return (
      <SafeAreaView style={s.admin} edges={["top", "left", "right"]}>
        <AdminSkeleton />
      </SafeAreaView>
    );
  }

  if (error && !dashboard) {
    return (
      <SafeAreaView style={s.admin} edges={["top", "left", "right"]}>
        <View style={s.adminHeader}>
          <View><Text style={s.eyebrow}>ESPACE PROFESSIONNEL</Text><Text style={s.adminTitle}>Connexion</Text></View>
          <Pressable onPress={onLogout} style={s.avatar}><Ionicons name="log-out-outline" size={18} color={C.gold} /></Pressable>
        </View>
        <ErrorState title="Espace pro indisponible" message={error} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.admin} edges={["top", "left", "right"]}>
      <View style={s.adminHeader}><View><Text style={s.eyebrow}>ESPACE PROFESSIONNEL</Text><Text style={s.adminTitle}>{items.find((item) => item.id === view)?.label}</Text></View><Pressable onPress={onLogout} style={s.avatar}><Ionicons name="log-out-outline" size={18} color={C.gold} /></Pressable></View>
      <ScrollView contentContainerStyle={[s.adminContent, { paddingBottom: 100 + insets.bottom }]}>
        {!!error && <ErrorBanner message={error} onRetry={refresh} />}
        {view === "overview" && <>
          <Text style={s.adminWelcome}>Bonjour Mehdi</Text><Text style={s.summaryMuted}>Données actualisées depuis PostgreSQL.</Text>
          <View style={s.statsGrid}>{[["Réservations", String(dashboard?.total ?? "—")], ["Revenus", dashboard ? `${dashboard.revenue.toLocaleString("fr-FR")} DZD` : "—"], ["En attente", String(dashboard?.pending ?? "—")]].map(([label, value]) => <View key={label} style={s.statCard}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>)}</View>
          <View style={s.adminPanel}><Text style={s.panelTitle}>Prochaines réservations</Text>{bookings.slice(0, 5).map((item) => <Pressable key={item.id} style={s.todayItem} onPress={() => { openBooking(item); setView("reservations"); }}><View style={s.statusDot} /><Text style={s.todayText} numberOfLines={1}>{item.customerName} · {new Date(item.startAt).toLocaleString("fr-FR")} · {statusLabel(item.status)}</Text></Pressable>)}{!bookings.length && <Text style={s.emptyText}>Aucune réservation.</Text>}</View>
        </>}
        {view === "reservations" && (selectedBooking ? <View style={s.adminPanel}>
          <Pressable onPress={() => setSelectedBooking(null)}><Text style={s.textButton}>‹ Retour à l’historique</Text></Pressable>
          {detailLoading ? (
            <View style={{ marginTop: 10 }}>
              <Skeleton style={{ width: 160, height: 20, borderRadius: 6, marginBottom: 10 }} />
              <SkeletonRows count={4} height={16} radius={4} />
            </View>
          ) : (
            <>
              <Text style={s.panelTitle}>{selectedBooking.customerName}</Text><Text style={s.summaryMuted}>{selectedBooking.bookingReference} · {statusLabel(selectedBooking.status)}</Text>
              <Text style={s.detailLabel}>CONTACT</Text><Text style={s.summaryText}>{selectedBooking.customerPhone}</Text><Text style={s.summaryText}>{selectedBooking.address}, {selectedBooking.commune}</Text>
              <Text style={s.detailLabel}>RENDEZ-VOUS</Text><Text style={s.summaryText}>{new Date(selectedBooking.startAt).toLocaleString("fr-FR")} · {selectedBooking.duration} min</Text><Text style={s.summaryText}>{money(selectedBooking.totalPrice)}</Text>
              <View style={s.inlineButtons}><GoldButton label="CONFIRMER" loading={saving} disabled={selectedBooking.status !== "PENDING"} onPress={() => updateStatus(selectedBooking.id, "CONFIRMED")} /><GoldButton label="ANNULER" outline disabled={saving || selectedBooking.status !== "PENDING"} onPress={() => updateStatus(selectedBooking.id, "CANCELLED")} /></View>
              <Text style={s.lockNote}>Une réservation confirmée ou annulée est définitive.</Text>
            </>
          )}
        </View> : <View style={s.adminPanel}><Text style={s.panelTitle}>Historique des réservations</Text>{bookings.map((item) => <Pressable key={item.id} style={s.reservationRow} onPress={() => openBooking(item)}><View style={{ flex: 1 }}><Text style={s.cardTitle}>{item.customerName} · {statusLabel(item.status)}</Text><Text style={s.summaryMuted}>{new Date(item.startAt).toLocaleString("fr-FR")} · {item.commune}</Text></View><Text style={s.cardPrice}>{money(item.totalPrice)}</Text></Pressable>)}{!bookings.length && <Text style={s.emptyText}>Aucune réservation enregistrée.</Text>}</View>)}
        {view === "calendar" && <>
          <View style={s.adminPanel}><Text style={s.panelTitle}>Horaires hebdomadaires</Text>{hours.map((item) => <View key={item.dayOfWeek} style={s.hoursRow}><Text style={s.cardTitle}>{days[item.dayOfWeek]}</Text><TextInput value={String(item.openingTime).slice(0, 5)} editable={item.isOpen} onChangeText={(value) => setHours((current) => current.map((row) => row.dayOfWeek === item.dayOfWeek ? { ...row, openingTime: value } : row))} style={s.adminInput} /><TextInput value={String(item.closingTime).slice(0, 5)} editable={item.isOpen} onChangeText={(value) => setHours((current) => current.map((row) => row.dayOfWeek === item.dayOfWeek ? { ...row, closingTime: value } : row))} style={s.adminInput} /><Pressable onPress={() => setHours((current) => current.map((row) => row.dayOfWeek === item.dayOfWeek ? { ...row, isOpen: !row.isOpen } : row))}><Text style={[s.openState, !item.isOpen && { color: C.muted }]}>{item.isOpen ? "OUVERT" : "FERMÉ"}</Text></Pressable></View>)}<GoldButton label="ENREGISTRER LES HORAIRES" loading={saving} onPress={saveHours} /></View>
          <View style={s.adminPanel}><Text style={s.panelTitle}>Bloquer une période</Text><Text style={s.fieldLabel}>Date (AAAA-MM-JJ)</Text><TextInput value={blockedDate} onChangeText={setBlockedDate} placeholder="2099-12-01" placeholderTextColor="#777" style={s.input} /><View style={s.hoursRow}><TextInput value={blockedStart} onChangeText={setBlockedStart} style={s.adminInput} /><TextInput value={blockedEnd} onChangeText={setBlockedEnd} style={s.adminInput} /></View><TextInput value={blockedReason} onChangeText={setBlockedReason} placeholder="Motif" placeholderTextColor="#777" style={s.input} /><View style={s.inlineButtons}><GoldButton label="BLOQUER" loading={saving} onPress={addBlocked} /><GoldButton label="JOURNÉE ENTIÈRE" outline disabled={saving} onPress={blockFullDay} /></View></View>
          <View style={s.adminPanel}><Text style={s.panelTitle}>Périodes bloquées</Text>{blockedSlots.map((slot) => <View key={slot.id} style={s.reservationRow}><View style={{ flex: 1 }}><Text style={s.cardTitle}>{new Date(slot.startAt).toLocaleString("fr-FR")}</Text><Text style={s.summaryMuted}>{new Date(slot.endAt).toLocaleString("fr-FR")} · {slot.reason}</Text></View><Pressable onPress={() => run(() => api.removeBlockedSlot(slot.id), "Blocage supprimé")}><Text style={s.confirmChipText}>Supprimer</Text></Pressable></View>)}{!blockedSlots.length && <Text style={s.emptyText}>Aucun créneau bloqué.</Text>}</View>
        </>}
        {view === "services" && <View style={s.adminPanel}>
          <Text style={s.panelTitle}>Services</Text>
          <Text style={s.summaryMuted}>Modifiez le nom, le prix et la durée. Les clients voient les changements immédiatement.</Text>
          {services.map((service) => (
            <View key={service.id} style={s.adminService}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{service.name}</Text>
                <Text style={s.summaryMuted}>{service.durationMinutes} min · {money(service.priceDzd)}</Text>
              </View>
              <Pressable onPress={() => openEditor(service)} style={s.editButton} hitSlop={6}>
                <Ionicons name="create-outline" size={14} color={C.gold} />
                <Text style={s.editButtonText}>MODIFIER</Text>
              </Pressable>
              <Pressable onPress={() => run(() => api.updateService(service.id, { isActive: !service.isActive }), service.isActive ? "Service désactivé" : "Service activé")} hitSlop={6}>
                <Text style={[s.openState, !service.isActive && { color: C.muted }]}>{service.isActive ? "ACTIF" : "INACTIF"}</Text>
              </Pressable>
            </View>
          ))}
          {!services.length && <Text style={s.emptyText}>Aucun service.</Text>}
        </View>}
        {view === "notifications" && <View style={s.adminPanel}>
          <Text style={s.panelTitle}>Historique des notifications</Text>
          <Text style={[s.summaryMuted, { marginBottom: 10 }]}>Les alertes de réservation restent visibles ici même si le push n'est pas disponible.</Text>
          {pushStatus ? (
            <View style={s.pushNote}>
              <Ionicons name={pushStatus.startsWith("Notifications") ? "checkmark-circle" : "information-circle"} size={16} color={pushStatus.startsWith("Notifications") ? C.success : C.muted} />
              <Text style={s.pushNoteText}>{pushStatus}</Text>
            </View>
          ) : null}
          {notifications.map((item) => {
            const status = notificationStatus(item.status);
            return (
              <View key={item.id} style={s.notification}>
                <Ionicons name={status.icon} size={20} color={status.color} />
                <View style={{ flex: 1 }}>
                  <Text style={s.notificationText}>{item.title}</Text>
                  <Text style={s.summaryMuted}>{item.body}</Text>
                  <Text style={[s.notificationStatus, { color: status.color }]}>{status.label}</Text>
                  {item.status === "FAILED" && item.errorMessage ? <Text style={s.notificationError}>{item.errorMessage}</Text> : null}
                </View>
              </View>
            );
          })}
          {!notifications.length && <Text style={s.emptyText}>Aucune notification.</Text>}
        </View>}
      </ScrollView>
      <View style={[s.adminNav, { height: 72 + insets.bottom, paddingBottom: insets.bottom }]}>{items.map((item) => <Pressable key={item.id} onPress={() => { setView(item.id); setSelectedBooking(null); }} style={s.adminNavItem}><Ionicons name={item.icon} size={20} color={view === item.id ? C.gold : C.muted} /><Text style={[s.adminNavText, view === item.id && { color: C.gold }]}>{item.label}</Text></Pressable>)}</View>
      {toast ? <Toast message={toast} onDone={() => setToast("")} /> : null}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={s.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
              <View style={s.modalCard}>
                <View style={s.modalHeader}>
                  <Text style={s.panelTitle}>Modifier le service</Text>
                  <Pressable onPress={() => setEditing(null)} hitSlop={10}><Ionicons name="close" size={20} color={C.muted} /></Pressable>
                </View>
                {!!editError && (
                  <View style={s.fieldErrorRow}>
                    <Ionicons name="alert-circle" size={13} color={C.danger} />
                    <Text style={s.fieldError}>{editError}</Text>
                  </View>
                )}
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>Nom du service</Text>
                <TextInput value={editName} onChangeText={setEditName} style={s.input} placeholderTextColor="#777" />
                <Text style={s.fieldLabel}>Prix (DZD)</Text>
                <TextInput value={editPrice} onChangeText={setEditPrice} keyboardType="number-pad" style={s.input} placeholderTextColor="#777" />
                <Text style={s.fieldLabel}>Durée (minutes)</Text>
                <TextInput value={editDuration} onChangeText={setEditDuration} keyboardType="number-pad" style={s.input} placeholderTextColor="#777" />
                <Text style={s.fieldLabel}>Description</Text>
                <TextInput value={editDescription} onChangeText={setEditDescription} multiline style={[s.input, s.inputMultiline]} placeholderTextColor="#777" />
                <View style={s.modalActions}>
                  <GoldButton label="ENREGISTRER" loading={saving} onPress={saveEditor} />
                  <Pressable onPress={() => setEditing(null)} style={{ alignItems: "center" }}><Text style={s.textButton}>Annuler</Text></Pressable>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function RoleGate({ onChoose }: { onChoose: (role: Role) => void }) {
  return (
    <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
      <View style={s.roleGate}>
        <View style={s.splashGlow} />
        <Brand />
        <Text style={s.splashTagline}>SERVICE À DOMICILE · ALGER</Text>
        <View style={s.roleButtons}>
          <GoldButton label="JE SUIS CLIENT" onPress={() => onChoose("client")} />
          <GoldButton label="JE SUIS LE BARBIER" onPress={() => onChoose("admin")} outline />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Login({ role, onLogin, onBack }: { role: Role; onLogin: (phone: string, password: string) => Promise<void>; onBack: () => void }) {
  const [phone, setPhone] = useState(role === "admin" ? "0550 24 18 18" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
  const submit = async () => {
    if (submitting) return;
    setError(""); setSubmitting(true);
    try { await onLogin(phone, password); }
    catch (e) { setError(message(e, "Connexion impossible")); }
    finally { setSubmitting(false); }
  };
  return (
    <SafeAreaView style={s.phone} edges={["top", "left", "right"]}>
      <TopBar title={role === "admin" ? "Connexion professionnelle" : "Connexion client"} onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.login} keyboardShouldPersistTaps="handled">
          <Brand />
          <Text style={s.loginTitle}>{role === "admin" ? "Accès espace pro" : "Bienvenue"}</Text>
          {!!error && <ErrorBanner message={error} />}
          <Text style={s.fieldLabel}>Téléphone</Text>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={s.input} placeholder="0550 00 00 00" placeholderTextColor="#777" />
          <Text style={s.fieldLabel}>Code secret</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry style={s.input} placeholder="••••••" placeholderTextColor="#777" />
          <View style={{ marginTop: 12 }}><GoldButton label="SE CONNECTER" loading={submitting} onPress={submit} /></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BootSplash() {
  const travel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(travel, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(travel, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [travel]);
  return (
    <SafeAreaView style={[s.phone, s.boot]} edges={["top", "left", "right"]}>
      <View style={s.splashGlow} />
      <Brand />
      <Text style={s.splashTagline}>SERVICE À DOMICILE · ALGER</Text>
      <View style={s.bootTrack}>
        <Animated.View style={[s.bootFill, { transform: [{ translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [-80, 160] }) }] }]} />
      </View>
      <LoadingLabel label="Ouverture" />
    </SafeAreaView>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [sessions, setSessions] = useState({ client: false, admin: false });

  useEffect(() => {
    Promise.all([
      storage.get("mahdi.session.client"),
      storage.get("mahdi.session.admin"),
    ]).then(([client, admin]) => {
      setSessions({ client: client === "active", admin: admin === "active" });
      setBooting(false);
    }).catch(() => setBooting(false));
  }, []);

  const login = async (phone: string, password: string) => {
    if (!role) return;
    await api.login(phone, password);
    await storage.set(`mahdi.session.${role}`, "active");
    setSessions((current) => ({ ...current, [role]: true }));
  };

  const logout = async () => {
    if (!role) return;
    await api.logout().catch(() => undefined);
    await storage.remove(`mahdi.session.${role}`).catch(() => undefined);
    setSessions((current) => ({ ...current, [role]: false }));
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {booting ? (
        <BootSplash />
      ) : !role ? (
        <RoleGate onChoose={setRole} />
      ) : role === "client" ? (
        <ClientApp onOpenAdmin={() => setRole("admin")} />
      ) : sessions.admin ? (
        <AdminApp onLogout={async () => { await logout(); setRole(null); }} />
      ) : (
        <Login role="admin" onLogin={login} onBack={() => setRole(null)} />
      )}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  phone: { flex: 1, backgroundColor: C.bg },
  boot: { alignItems: "center", justifyContent: "center", gap: 14 },
  bootText: { color: C.gold, fontSize: 28, letterSpacing: 10 },
  bootTrack: { width: 140, height: 1, backgroundColor: C.line, overflow: "hidden", marginTop: 10 },
  bootFill: { width: 80, height: 1, backgroundColor: C.gold },
  skeletonFooter: { paddingTop: 16 },
  errorText: { color: C.danger, fontSize: 12, textAlign: "center", padding: 20 },
  brand: { alignItems: "center", gap: 14 },
  brandCompact: { flexDirection: "row", gap: 9 },
  brandMark: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: C.gold, alignItems: "center", justifyContent: "center" },
  brandMarkSmall: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.gold, alignItems: "center", justifyContent: "center" },
  brandName: { color: C.text, fontSize: 25, letterSpacing: 9, fontWeight: "700" },
  brandNameSmall: { fontSize: 15, letterSpacing: 4 },
  brandSub: { color: C.gold, fontSize: 7, letterSpacing: 3, marginTop: 5 },
  topBar: { height: 68, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  progress: { height: 20, marginHorizontal: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.line },
  progressDotActive: { backgroundColor: C.gold },
  goldButton: { height: 52, minWidth: 170, borderRadius: 4, backgroundColor: C.gold, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  goldButtonText: { color: "#17130d", fontSize: 11, letterSpacing: 1.5, fontWeight: "800" },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.gold },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  scroll: { paddingBottom: 100 },
  homeHeader: { height: 74, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#292929", borderWidth: 1, borderColor: C.gold, alignItems: "center", justifyContent: "center" },
  hero: { height: 390, marginHorizontal: 12, borderRadius: 18, overflow: "hidden" },
  heroCopy: { position: "absolute", left: 22, right: 22, bottom: 28 },
  eyebrow: { color: C.gold, fontSize: 9, letterSpacing: 2, fontWeight: "700" },
  heroTitle: { color: C.text, fontSize: 38, lineHeight: 43, fontWeight: "700", marginVertical: 14 },
  goldSerif: { color: C.gold, fontFamily: "serif", fontStyle: "italic", fontWeight: "400" },
  homeBody: { padding: 24 },
  sectionTitle: { color: C.text, fontSize: 22, fontWeight: "700", marginTop: 5, marginBottom: 14 },
  popularCard: { width: 150, marginRight: 12, backgroundColor: C.panel, borderRadius: 12, overflow: "hidden", paddingBottom: 12 },
  popularImage: { width: "100%", height: 145, marginBottom: 10 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: "700", paddingHorizontal: 12 },
  cardPrice: { color: C.gold, fontSize: 12, fontWeight: "700", paddingHorizontal: 12, marginTop: 5 },
  availability: { marginTop: 22, height: 86, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 },
  availabilityIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2d281e", alignItems: "center", justifyContent: "center" },
  availabilityTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginTop: 5 },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: "#151515", flexDirection: "row" },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  navText: { color: C.muted, fontSize: 9 },
  screenContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 110 },
  screenTitle: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: "700", marginTop: 8, marginBottom: 20 },
  serviceRow: { height: 108, marginBottom: 10, borderRadius: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: "transparent", flexDirection: "row", alignItems: "center", overflow: "hidden" },
  serviceRowActive: { borderColor: C.gold },
  serviceImage: { width: 86, height: "100%" },
  serviceDesc: { color: C.muted, fontSize: 10, marginTop: 5 },
  serviceDuration: { color: "#777", fontSize: 9, marginTop: 8 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: "#777", alignItems: "center", justifyContent: "center" },
  checkActive: { backgroundColor: C.gold, borderColor: C.gold },
  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: "#151515", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionBarFull: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: "#151515", padding: 16 },
  actionMeta: { color: C.muted, fontSize: 10, marginBottom: 4 },
  actionTotal: { color: C.text, fontSize: 16, fontWeight: "800" },
  monthTitle: { color: C.gold, fontSize: 10, letterSpacing: 2, marginBottom: 10 },
  dateCard: { width: 62, height: 78, marginRight: 8, borderRadius: 8, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", gap: 4 },
  dateCardActive: { backgroundColor: C.gold, borderColor: C.gold },
  dateWeekday: { color: C.muted, fontSize: 9, textTransform: "capitalize" },
  dateNumber: { color: C.text, fontSize: 22, fontWeight: "700" },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: { width: "23%", height: 44, borderRadius: 6, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  slotActive: { backgroundColor: C.gold, borderColor: C.gold },
  slotBlocked: { backgroundColor: "#171717", borderColor: "#262626" },
  slotTakenText: { color: "#6f6f6f", textDecorationLine: "line-through" },
  slotTakenLabel: { color: "#6f6f6f", fontSize: 7, letterSpacing: 0.5, marginTop: 1 },
  slotText: { color: C.text, fontSize: 12, fontWeight: "700" },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { color: C.muted, fontSize: 11, marginBottom: 7 },
  input: { height: 52, borderRadius: 6, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, color: C.text, paddingHorizontal: 14 },
  inputError: { borderColor: C.danger, backgroundColor: C.dangerSoft },
  fieldErrorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 },
  fieldError: { color: C.danger, fontSize: 10, flex: 1 },
  summaryCard: { backgroundColor: C.panel, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 18, marginBottom: 12 },
  summaryDate: { color: C.text, fontSize: 20, fontWeight: "700", marginTop: 12 },
  summaryText: { color: C.text, fontSize: 12 },
  summaryMuted: { color: C.muted, fontSize: 12, marginTop: 5 },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  summaryTotal: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 14, paddingTop: 12, flexDirection: "row", justifyContent: "space-between" },
  summaryTotalValue: { color: C.gold, fontSize: 16, fontWeight: "800" },
  successContent: { flexGrow: 1 },
  success: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  successSeal: { width: 82, height: 82, borderRadius: 41, borderWidth: 1, borderColor: C.gold, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  successTitle: { color: C.text, fontSize: 34, fontWeight: "700", textAlign: "center" },
  successNote: { color: C.muted, fontSize: 12, textAlign: "center", marginHorizontal: 24 },
  ticket: { width: "100%", minHeight: 150, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.gold, padding: 18, marginVertical: 10 },
  ticketTitle: { color: C.gold, fontSize: 18, letterSpacing: 6, fontWeight: "800" },
  textButton: { color: C.muted, fontSize: 12, marginTop: 10 },
  bookingCard: { minHeight: 92, marginBottom: 10, borderRadius: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", paddingRight: 12 },
  dateBlock: { width: 64, alignSelf: "stretch", borderRightWidth: 1, borderRightColor: C.line, alignItems: "center", justifyContent: "center", gap: 3 },
  dateBlockText: { color: C.gold, fontSize: 11, fontWeight: "800" },
  dateBlockTime: { color: C.muted, fontSize: 9 },
  bookingStatus: { color: C.success, fontSize: 9, marginBottom: 2 },
  roleGate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  splashGlow: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "rgba(201,164,92,.08)" },
  splashTagline: { color: C.muted, fontSize: 8, letterSpacing: 3, marginTop: 24 },
  roleButtons: { width: "100%", gap: 12, marginTop: 90 },
  login: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center", gap: 10 },
  loginTitle: { color: C.text, fontSize: 28, fontWeight: "700", marginVertical: 20 },
  admin: { flex: 1, backgroundColor: "#111" },
  adminHeader: { height: 92, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.line },
  adminTitle: { color: C.text, fontSize: 22, fontWeight: "700", marginTop: 5 },
  adminContent: { padding: 18, paddingBottom: 100 },
  adminWelcome: { color: C.text, fontSize: 24, fontWeight: "700" },
  statsGrid: { flexDirection: "row", gap: 8, marginTop: 18 },
  statCard: { flex: 1, height: 118, backgroundColor: C.panel, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 12, justifyContent: "flex-end" },
  statValue: { color: C.text, fontSize: 14, fontWeight: "800" },
  statLabel: { color: C.muted, fontSize: 9, marginTop: 4 },
  adminPanel: { backgroundColor: C.panel, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 14 },
  panelTitle: { color: C.text, fontSize: 18, fontWeight: "700", marginTop: 5 },
  todayItem: { minHeight: 46, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success },
  todayText: { color: C.text, fontSize: 11, flex: 1 },
  reservationRow: { minHeight: 66, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  confirmChip: { height: 32, borderRadius: 16, backgroundColor: "#263128", paddingHorizontal: 10, justifyContent: "center" },
  confirmChipText: { color: "#87af8a", fontSize: 9, fontWeight: "700" },
  lockNote: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 10 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 14 },
  calendarDay: { width: "14.28%", height: 46, borderWidth: 0.5, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  calendarDayBooked: { backgroundColor: "#4b4029" },
  calendarDayText: { color: C.text, fontSize: 11 },
  adminService: { minHeight: 86, marginBottom: 10, backgroundColor: C.panel, borderRadius: 10, borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", paddingRight: 14, gap: 8 },
  editButton: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(201,164,92,.5)", borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 },
  editButtonText: { color: C.gold, fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.72)", paddingHorizontal: 18 },
  modalCard: { backgroundColor: C.panel, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 18, maxWidth: 460, width: "100%", alignSelf: "center" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalActions: { gap: 10, marginTop: 18 },
  inputMultiline: { height: 84, paddingTop: 12, textAlignVertical: "top" },
  adminServiceImage: { width: 72, height: "100%", marginRight: 12, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  toggleOn: { width: 42, height: 24, borderRadius: 12, backgroundColor: C.gold, justifyContent: "center", alignItems: "flex-end", paddingRight: 3 },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#171717" },
  notification: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  notificationText: { color: C.text, fontSize: 11 },
  notificationStatus: { fontSize: 9, marginTop: 4, fontWeight: "700" },
  notificationError: { color: C.danger, fontSize: 9, marginTop: 3 },
  pushNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#1c1c1c", borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 8 },
  pushNoteText: { color: C.muted, fontSize: 10, lineHeight: 15, flex: 1 },
  noticeText: { color: C.success, fontSize: 12, padding: 12, textAlign: "center" },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 30, paddingHorizontal: 20 },
  recoverCard: { backgroundColor: C.panel, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 16 },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: "rgba(201,164,92,.3)", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: C.text, fontSize: 14, fontWeight: "700", textAlign: "center" },
  emptyText: { color: C.muted, fontSize: 11, textAlign: "center", lineHeight: 16, paddingVertical: 14 },
  detailLabel: { color: C.gold, fontSize: 9, letterSpacing: 2, marginTop: 18, marginBottom: 6 },
  inlineButtons: { flexDirection: "row", gap: 8, marginTop: 16, flexWrap: "wrap" },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 6 },
  adminInput: { height: 42, minWidth: 66, flex: 1, borderRadius: 5, borderWidth: 1, borderColor: C.line, backgroundColor: "#111", color: C.text, paddingHorizontal: 8, fontSize: 11 },
  openState: { color: C.gold, fontSize: 9, fontWeight: "800", minWidth: 52, textAlign: "right" },
  adminNav: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#151515", borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row" },
  adminNavItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  adminNavText: { color: C.muted, fontSize: 8 },
  inlineRetry: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8 },
  retryText: { color: C.gold, fontSize: 9, letterSpacing: 1.5, fontWeight: "800" },
});
