import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { invoicesApi, getBackendUrl, getSessionCookie } from "@/lib/api";
import Colors from "@/constants/colors";
import { useCustomAlert } from "@/components/CustomAlert";

const API_BASE = "https://appmyjantes2.mytoolsgroup.eu";

function getInvoiceStatusInfo(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "paid" || s === "payée" || s === "payé")
    return { label: "Payée", color: "#16A34A", bg: "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "pending" || s === "en_attente")
    return { label: "En attente", color: "#D97706", bg: "#FEF3C7", icon: "time-outline" as const };
  if (s === "overdue" || s === "en_retard")
    return { label: "En retard", color: "#DC2626", bg: "#FEE2E2", icon: "alert-circle-outline" as const };
  if (s === "sent" || s === "envoyée" || s === "envoyee")
    return { label: "Envoyée", color: "#3B82F6", bg: "#DBEAFE", icon: "send-outline" as const };
  if (s === "cancelled" || s === "annulée" || s === "annulee")
    return { label: "Annulée", color: Colors.textTertiary, bg: Colors.surfaceSecondary, icon: "close-circle-outline" as const };
  if (s === "draft" || s === "brouillon")
    return { label: "Brouillon", color: Colors.textSecondary, bg: Colors.surfaceSecondary, icon: "create-outline" as const };
  return { label: status || "Inconnu", color: Colors.textSecondary, bg: Colors.surfaceSecondary, icon: "help-outline" as const };
}

function parseItems(items: any): any[] {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        <Ionicons name={icon as any} size={16} color={Colors.textSecondary} />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function InvoiceDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [downloading, setDownloading] = React.useState(false);
  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      try {
        const detail = await invoicesApi.getById(id!);
        if (detail && detail.id) return detail;
      } catch {}
      const all = await invoicesApi.getAll();
      const list = Array.isArray(all) ? all : [];
      return list.find((inv) => inv.id === id) || null;
    },
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.errorText}>Facture introuvable</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  console.log("[INVOICE DEBUG] invoice keys:", Object.keys(invoice), "invoice data:", JSON.stringify(invoice).substring(0, 1000));

  const statusInfo = getInvoiceStatusInfo(invoice.status);
  const createdDate = new Date(invoice.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const invoiceItems = parseItems(
    invoice.items ||
    (invoice as any).lineItems ||
    (invoice as any).line_items ||
    (invoice as any).lignes ||
    (invoice as any).lines ||
    (invoice as any).prestations ||
    (invoice as any).invoiceLines ||
    (invoice as any).invoice_lines ||
    (invoice as any).details ||
    (invoice as any).rows
  );
  const viewToken = ((invoice as any).viewToken || (invoice as any).pdfToken || (invoice as any).token || (invoice as any).publicToken || (invoice as any).shareToken || (invoice as any).accessToken || (invoice as any).publicId) as string | undefined;
  const directPdfUrl = (invoice as any).pdfUrl || (invoice as any).pdf_url || (invoice as any).documentUrl || (invoice as any).document_url;
  const displayRef = invoice.invoiceNumber || invoice.id;
  const clientInfo = (invoice as any).client || null;
  const quoteRef = (invoice as any).quoteNumber || (invoice as any).quoteReference || null;

  const inv = invoice as any;
  const totalHTRaw =
    invoice.totalHT ||
    inv.total_ht ||
    inv.totalExcludingTax ||
    inv.total_excluding_tax ||
    inv.amountHT ||
    inv.amount_ht ||
    inv.amountExcludingTax ||
    inv.amount_excluding_tax ||
    inv.montantHT ||
    inv.montant_ht ||
    inv.subtotal ||
    inv.sub_total ||
    inv.priceExcludingTax ||
    inv.price_excluding_tax ||
    "0";
  const totalHTNum = parseFloat(totalHTRaw) || 0;

  const tvaAmountRaw =
    invoice.tvaAmount ||
    inv.tva_amount ||
    inv.taxAmount ||
    inv.tax_amount ||
    inv.vatAmount ||
    inv.vat_amount ||
    inv.montantTVA ||
    inv.montant_tva ||
    "0";
  const tvaAmountNum = parseFloat(tvaAmountRaw) || 0;

  const totalTTCRaw =
    invoice.totalTTC ||
    inv.total_ttc ||
    inv.totalIncludingTax ||
    inv.total_including_tax ||
    inv.totalAmountIncludingTax ||
    inv.total_amount_including_tax ||
    inv.totalWithTax ||
    inv.total_with_tax ||
    inv.montantTTC ||
    inv.montant_ttc ||
    inv.amount ||
    inv.totalAmount ||
    inv.total_amount ||
    inv.total ||
    "0";

  let totalTTCNum = parseFloat(totalTTCRaw) || 0;
  if (totalTTCNum === 0 && totalHTNum > 0) {
    totalTTCNum = totalHTNum + tvaAmountNum;
  }
  if (totalTTCNum === 0 && invoiceItems.length > 0) {
    let itemsTotal = 0;
    for (const item of invoiceItems) {
      const qty = parseFloat(item.quantity || item.qty || "1") || 1;
      const up = parseFloat(item.unitPrice || item.unit_price || item.price || item.priceHT || item.price_ht || "0");
      const lt = parseFloat(item.total || item.totalHT || item.total_ht || item.lineTotal || item.line_total || "0");
      itemsTotal += lt > 0 ? lt : (up * qty);
    }
    if (itemsTotal > 0) {
      totalTTCNum = itemsTotal * (1 + (parseFloat(invoice.tvaRate || inv.tva_rate || inv.taxRate || inv.tax_rate || "20") / 100));
    }
  }

  const tvaRateNum = parseFloat(invoice.tvaRate || inv.tva_rate || inv.taxRate || inv.tax_rate || "20");

  const statusLower = invoice.status?.toLowerCase() || "";
  const isUnpaid = statusLower === "pending" || statusLower === "en_attente"
    || statusLower === "overdue" || statusLower === "en_retard"
    || statusLower === "sent" || statusLower === "envoyee" || statusLower === "envoyée";
  const pdfUrl = viewToken ? `${getBackendUrl()}/api/proxy/invoice-pdf/${viewToken}` : directPdfUrl || null;

  const handleDownloadPdf = async () => {
    const url = pdfUrl;
    if (!url) return;
    if (Platform.OS === "web") {
      try { await WebBrowser.openBrowserAsync(url); } catch { Linking.openURL(url); }
      return;
    }
    setDownloading(true);
    try {
      const cookie = getSessionCookie();
      const filename = `facture-${id}-${Date.now()}.pdf`;
      const fileUri = (FileSystem.cacheDirectory ?? "") + filename;
      const result = await FileSystem.downloadAsync(url, fileUri, {
        headers: cookie ? { Cookie: cookie } : {},
      });
      if (result.status !== 200) throw new Error(`Erreur ${result.status}`);
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Facture PDF",
          UTI: "com.adobe.pdf",
        });
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Erreur de téléchargement",
        message: err?.message || "Impossible de télécharger la facture.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setDownloading(false);
    }
  };


  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Détail facture</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusCard}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon} size={20} color={statusInfo.color} />
            <Text style={[styles.statusTextLarge, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
          <Text style={styles.invoiceNumber}>{displayRef}</Text>
          <Text style={styles.invoiceDate}>{createdDate}</Text>
          {totalTTCNum > 0 && (
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{totalTTCNum.toFixed(2)} € TTC</Text>
            </View>
          )}
        </View>

        {quoteRef && (
          <View style={styles.refCard}>
            <Ionicons name="link-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.refText}>Devis associé : {quoteRef}</Text>
          </View>
        )}

        {clientInfo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Client</Text>
            </View>
            <View style={styles.sectionContent}>
              {(clientInfo.firstName || clientInfo.lastName) && (
                <InfoRow icon="person-outline" label="Nom" value={`${clientInfo.firstName || ''} ${clientInfo.lastName || ''}`.trim()} />
              )}
              {clientInfo.email && <InfoRow icon="mail-outline" label="Email" value={clientInfo.email} />}
              {clientInfo.phone && <InfoRow icon="call-outline" label="Téléphone" value={clientInfo.phone} />}
              {clientInfo.address && <InfoRow icon="location-outline" label="Adresse" value={`${clientInfo.address}${clientInfo.postalCode ? ', ' + clientInfo.postalCode : ''}${clientInfo.city ? ' ' + clientInfo.city : ''}`} />}
              {clientInfo.companyName && <InfoRow icon="business-outline" label="Société" value={clientInfo.companyName} />}
              {clientInfo.siret && <InfoRow icon="card-outline" label="SIRET" value={clientInfo.siret} />}
            </View>
          </View>
        )}

        {invoiceItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Lignes de la facture ({invoiceItems.length})</Text>
            </View>
            {invoiceItems.map((item: any, idx: number) => {
              const qty = item.quantity ? parseFloat(item.quantity) : 1;
              const unitPrice = item.unitPrice || item.price || item.priceHT || null;
              const lineTotal = item.total || item.totalHT || (unitPrice ? (parseFloat(unitPrice) * qty).toString() : null);
              const desc = item.description || item.name || item.label || `Ligne ${idx + 1}`;
              const details = item.serviceDetails || item.details || item.notes || "";
              return (
                <View key={idx} style={styles.lineItemCard}>
                  <Text style={styles.lineItemName}>{desc}</Text>
                  {details ? <Text style={styles.lineItemSubtext}>{details}</Text> : null}
                  <View style={styles.lineItemDetails}>
                    {unitPrice && (
                      <Text style={styles.lineItemMeta}>
                        {parseFloat(unitPrice).toFixed(2)} € x {qty}
                      </Text>
                    )}
                    {!unitPrice && qty > 1 && (
                      <Text style={styles.lineItemMeta}>Qté : {qty}</Text>
                    )}
                    {lineTotal && (
                      <Text style={styles.lineItemTotal}>
                        {parseFloat(lineTotal).toFixed(2)} € HT
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {(totalTTCNum > 0 || totalHTNum > 0 || invoiceItems.length > 0) && (
          <View style={styles.amountsCard}>
            <View style={styles.amountsHeader}>
              <Ionicons name="calculator-outline" size={18} color={Colors.primary} />
              <Text style={styles.amountsTitle}>Récapitulatif</Text>
            </View>
            {totalHTNum > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Montant HT</Text>
                <Text style={styles.amountHT}>{totalHTNum.toFixed(2)} €</Text>
              </View>
            )}
            {tvaAmountNum > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>TVA ({tvaRateNum}%)</Text>
                <Text style={styles.amountTVA}>{tvaAmountNum.toFixed(2)} €</Text>
              </View>
            )}
            <View style={[styles.amountRow, (totalHTNum > 0 || tvaAmountNum > 0) ? styles.totalRow : undefined]}>
              <Text style={styles.totalLabel}>Total TTC</Text>
              <Text style={styles.totalValue}>{totalTTCNum.toFixed(2)} €</Text>
            </View>
          </View>
        )}

        {invoice.dueDate && (
          <View style={styles.dateCard}>
            <Ionicons name="hourglass-outline" size={18} color={isUnpaid ? Colors.pending : Colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dateCardLabel}>Date d'échéance</Text>
              <Text style={styles.dateCardValue}>
                {new Date(invoice.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </View>
          </View>
        )}

        {invoice.paidAt && (
          <View style={styles.dateCard}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.accepted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dateCardLabel}>Payée le</Text>
              <Text style={styles.dateCardValue}>
                {new Date(invoice.paidAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </View>
          </View>
        )}

        {invoice.notes ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            <View style={styles.sectionContent}>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          </View>
        ) : null}

        {pdfUrl && (
          <View style={styles.footerActions}>
            <Pressable
              style={({ pressed }) => [styles.btnPdf, pressed && styles.btnPdfPressed, downloading && { opacity: 0.6 }]}
              onPress={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="download-outline" size={18} color={Colors.primary} />
              }
              <Text style={styles.btnPdfText}>{downloading ? "Téléchargement…" : "Télécharger la facture"}</Text>
            </Pressable>
          </View>
        )}
        
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  statusCard: { alignItems: "center", marginBottom: 20, gap: 8 },
  statusBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  statusTextLarge: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  invoiceNumber: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  invoiceDate: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  totalBadge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  totalBadgeText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  refCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  refText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  sectionContent: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  infoLabelText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "right",
    flex: 1,
  },
  lineItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lineItemName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    marginBottom: 2,
  },
  lineItemSubtext: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginBottom: 8,
  },
  lineItemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  lineItemMeta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  lineItemTotal: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  amountsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  amountsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  amountsTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  amountHT: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  amountTVA: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  totalRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  totalLabel: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  totalValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.primary },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateCardLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  dateCardValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  notesText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginTop: 12 },
  backLink: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 10 },
  backLinkText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  footerActions: {
    marginTop: 8,
    gap: 12,
    marginBottom: 20,
  },
  btnPdf: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  btnPdfPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  btnPdfText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
});
