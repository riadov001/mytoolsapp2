import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Text, Pressable, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

function CreateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const options = [
    {
      icon: "document-text-outline" as const,
      label: "Nouveau devis",
      sub: "Créer un devis",
      color: "#8B5CF6",
      route: "/(admin)/quote-create",
    },
    {
      icon: "receipt-outline" as const,
      label: "Nouvelle facture",
      sub: "Créer une facture",
      color: "#3B82F6",
      route: "/(admin)/invoice-create",
    },
    {
      icon: "person-add-outline" as const,
      label: "Nouveau client",
      sub: "Ajouter un client",
      color: "#10B981",
      route: "/(admin)/client-form",
    },
    {
      icon: "calendar-outline" as const,
      label: "Nouveau RDV",
      sub: "Planifier un rendez-vous",
      color: "#22C55E",
      route: "/(admin)/reservation-create",
    },
    {
      icon: "construct-outline" as const,
      label: "Nouveau service",
      sub: "Ajouter une prestation",
      color: "#F59E0B",
      route: "/(admin)/service-create",
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity style={modalStyles(theme).overlay} activeOpacity={1} onPress={onClose} />
      <View style={[modalStyles(theme).sheet, { paddingBottom: Math.max(insets.bottom, 28) }]}>
        <View style={modalStyles(theme).sheetHandle} />
        <Text style={modalStyles(theme).sheetTitle}>Créer</Text>
        <View style={modalStyles(theme).sheetOptions}>
          {options.map((opt) => (
            <Pressable
              key={opt.label}
              style={({ pressed }) => [modalStyles(theme).optionRow, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
                setTimeout(() => router.push(opt.route as any), 150);
              }}
            >
              <View style={[modalStyles(theme).optionIcon, { backgroundColor: opt.color + "18" }]}>
                <Ionicons name={opt.icon} size={22} color={opt.color} />
              </View>
              <View style={modalStyles(theme).optionText}>
                <Text style={modalStyles(theme).optionLabel}>{opt.label}</Text>
                <Text style={modalStyles(theme).optionSub}>{opt.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

export default function AdminTabLayout() {
  const theme = useTheme();
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textTertiary,
          tabBarLabelStyle: {
            fontFamily: "Inter_500Medium",
            fontSize: 10,
          },
          tabBarStyle: {
            position: "absolute" as const,
            backgroundColor: isIOS ? "transparent" : theme.surface,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            elevation: 0,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView intensity={100} tint={theme.isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            ) : isWeb ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface }]} />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="quotes"
          options={{
            title: "Devis",
            tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="invoices"
          options={{
            title: "Factures",
            tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: "",
            tabBarButton: () => (
              <View style={styles.plusWrapper}>
                <Pressable
                  style={({ pressed }) => [styles.plusBtn, pressed && { transform: [{ scale: 0.9 }], opacity: 0.85 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setCreateOpen(true);
                  }}
                >
                  <Ionicons name="add" size={34} color="#fff" />
                </Pressable>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="reservations"
          options={{
            title: "RDV",
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: "Clients",
            tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: "Analyse",
            tabBarIcon: ({ color, size }) => <Ionicons name="analytics-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Réglages",
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
      <CreateModal visible={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

const modalStyles = (theme: any) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.isDark ? theme.surfaceSecondary : theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 16,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: theme.isDark ? theme.border : "#D4D4D8",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: theme.text,
    marginBottom: 16,
    marginLeft: 2,
  },
  sheetOptions: {
    gap: 8,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.isDark ? theme.surfaceElevated : theme.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.isDark ? theme.border : "#F0F0F2",
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1 },
  optionLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
  },
  optionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
    marginTop: 2,
  },
});

const styles = StyleSheet.create({
  plusWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
  },
  plusBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
});
