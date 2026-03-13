import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { useTheme } from "@/lib/theme";

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  count?: number;
}

export function FilterChip({ label, active, onPress, color, count }: FilterChipProps) {
  const theme = useTheme();
  const activeColor = color || theme.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: activeColor, borderColor: activeColor }
          : { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      {active && <View style={styles.dot} />}
      <Text style={[styles.label, { color: active ? "#fff" : theme.textSecondary }]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.countBadge, { backgroundColor: active ? "rgba(255,255,255,0.25)" : activeColor + "20" }]}>
          <Text style={[styles.countText, { color: active ? "#fff" : activeColor }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
    elevation: 0.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  countBadge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  countText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
});
