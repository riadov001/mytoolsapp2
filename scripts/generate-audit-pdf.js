#!/usr/bin/env node
/**
 * Audit interne MyToolsApp mobile v2 — Générateur PDF
 * Police : Exo 2 (latin-ext) | Thème : MyTools Group
 */
"use strict";

const PDFDocument = require("pdfkit");
const fs          = require("fs");
const path        = require("path");

// ─── Chemins ──────────────────────────────────────────────────────────────────
const ROOT   = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "AUDIT_MyToolsApp_v2.pdf");
const LOGO   = path.join(ROOT, "assets/images/logo_new.png");
const MD     = path.join(ROOT, "AUDIT.md");
const FONTS  = path.join(__dirname, "fonts");

const FONT = {
  R:  path.join(FONTS, "Exo2-Regular.woff"),
  B:  path.join(FONTS, "Exo2-Bold.woff"),
  S:  path.join(FONTS, "Exo2-SemiBold.woff"),
  I:  path.join(FONTS, "Exo2-Italic.woff"),
};

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  red:      "#DC2626",
  redDark:  "#991B1B",
  redLight: "#FFF1F1",
  dark:     "#111827",
  gray1:    "#374151",
  gray2:    "#6B7280",
  gray3:    "#9CA3AF",
  border:   "#E5E7EB",
  bg:       "#F9FAFB",
  codeBg:   "#F3F4F6",
  text:     "#1F2937",
  white:    "#FFFFFF",
};

// ─── Mise en page A4 ──────────────────────────────────────────────────────────
const PW  = 595.28;
const PH  = 841.89;
const ML  = 50;
const MR  = 50;
const CW  = PW - ML - MR;  // 495.28
const HDR = 40;             // hauteur header
const FTR = 34;             // hauteur footer
const TOP = HDR + 16;       // début contenu
const BOT = PH - FTR - 14; // fin contenu

// ─── Document ─────────────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: "A4",
  autoFirstPage: false,
  bufferPages: true,
  info: {
    Title:    "Audit interne MyToolsApp mobile v2",
    Author:   "Riad BELMAHI — CTO, MyTools Group",
    Subject:  "Audit technique et fonctionnel — Application mobile partenaires garages",
    Creator:  "MyTools Group / Paf Invest Limited",
    Keywords: "audit, mobile, expo, react-native, mytoolsapp",
  },
});

doc.registerFont("R", FONT.R);
doc.registerFont("B", FONT.B);
doc.registerFont("S", FONT.S);
doc.registerFont("I", FONT.I);

doc.pipe(fs.createWriteStream(OUTPUT));

// ─── Nettoyage des caractères non supportés ───────────────────────────────────

// Tableau de remplacement des caractères hors plage font
const CHAR_MAP = {
  // Box drawing → ASCII
  "\u250C": "+", "\u2510": "+", "\u2514": "+", "\u2518": "+",
  "\u251C": "+", "\u2524": "+", "\u252C": "+", "\u2534": "+", "\u253C": "+",
  "\u2500": "-", "\u2501": "-", "\u2502": "|", "\u2503": "|",
  "\u2550": "=", "\u2551": "|",
  "\u256C": "+", "\u256B": "+", "\u256A": "+",
  "\u255E": "+", "\u255F": "+", "\u2560": "+", "\u2563": "+",
  // Flèches
  "\u2192": "->", "\u2190": "<-", "\u2193": "v", "\u2191": "^",
  "\u25BC": "v", "\u25B2": "^", "\u25BA": ">", "\u25C4": "<",
  // Bullets et symboles
  "\u2022": "*",  // bullet -> on dessine un cercle PDFKit
  "\u2014": "-",  // em dash
  "\u2013": "-",  // en dash
  "\u2019": "'",  // right single quote
  "\u2018": "'",  // left single quote
  "\u201C": '"',  // left double quote
  "\u201D": '"',  // right double quote
  "\u2026": "...",// ellipsis
  "\u00A0": " ",  // non-breaking space
  // Checkmarks et symboles
  "\u2713": "[OK]", "\u2714": "[OK]", "\u2705": "[OK]",
  "\u2717": "[X]",  "\u2718": "[X]",
  "\u2795": "[+]",  "\u2796": "[-]",
  "\u2630": "[=]",
  // Emojis (remplacés par étiquettes texte)
  "\uD83C\uDFE0": "[App]",
  "\uD83D\uDC65": "[Users]",
  "\uD83D\uDCCB": "[Liste]",
  "\uD83E\uDDFE": "[Facture]",
  "\uD83D\uDCC5": "[Date]",
  "\uD83D\uDCAC": "[Chat]",
  "\uD83D\uDD14": "[Notif]",
  "\uD83D\uDD12": "[Securite]",
};

function sanitize(str) {
  if (!str) return "";
  let out = str;
  for (const [from, to] of Object.entries(CHAR_MAP)) {
    out = out.split(from).join(to);
  }
  // Supprimer les caractères > U+02FF restants (émojis, etc.)
  out = out.replace(/[\u0300-\uFFFF]/g, (c) => {
    const cp = c.codePointAt(0);
    // Garder Latin Extended (0x00C0-0x024F) et ponctuation courante (0x2000-0x206F)
    if (cp >= 0x00C0 && cp <= 0x024F) return c;
    if (cp >= 0x2000 && cp <= 0x206F) return "-";
    return "";
  });
  return out;
}

function stripMd(str) {
  return sanitize(
    str
      .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^[#>]+\s*/, "")
      .trim()
  );
}

// ─── Primitives graphiques ────────────────────────────────────────────────────

function fillRect(x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

function strokeRect(x, y, w, h, color, lw = 0.5) {
  doc.save().rect(x, y, w, h).strokeColor(color).lineWidth(lw).stroke().restore();
}

function hLine(x1, y, x2, color = C.border, lw = 0.5) {
  doc.save().moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke().restore();
}

// ─── En-tête de page ──────────────────────────────────────────────────────────

let currentSection = "";

function drawHeader() {
  fillRect(0, 0, PW, HDR, C.dark);
  fillRect(0, HDR - 2, PW, 2, C.red);

  if (fs.existsSync(LOGO)) {
    try { doc.image(LOGO, ML, 8, { fit: [24, 24] }); } catch (_) {}
  }

  doc.font("B").fontSize(9).fillColor(C.white)
    .text("Audit interne MyToolsApp mobile v2", ML + 32, 10, { lineBreak: false });
  doc.font("R").fontSize(7.5).fillColor(C.gray3)
    .text("CONFIDENTIEL  |  Paf Invest Limited", ML + 32, 22, { lineBreak: false });

  if (currentSection) {
    const sw = doc.widthOfString(currentSection, { font: "R", size: 7.5 });
    const sx = Math.max(ML + 200, PW - MR - sw - 6);
    doc.font("R").fontSize(7.5).fillColor(C.gray3)
      .text(currentSection, sx, 20, { lineBreak: false });
  }
}

function drawFooter(pageNum, total) {
  fillRect(0, PH - FTR, PW, FTR, C.bg);
  hLine(0, PH - FTR, PW, C.border);

  doc.font("R").fontSize(7).fillColor(C.gray2)
    .text(
      "Riad BELMAHI (CTO)  |  Iliass MEGAIZ (CEO)  |  Paf Invest Limited  |  President : Naime BELAMIRI",
      ML, PH - FTR + 12, { lineBreak: false }
    );

  const pStr = pageNum + " / " + total;
  const pw2  = doc.widthOfString(pStr, { font: "B", size: 9 }) + 4;
  doc.font("B").fontSize(9).fillColor(C.red)
    .text(pStr, PW - MR - pw2, PH - FTR + 10, { lineBreak: false });
}

// ─── Page de couverture ───────────────────────────────────────────────────────

function buildCover() {
  doc.addPage({ size: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  // Fond haut sombre
  fillRect(0, 0, PW, 300, C.dark);
  fillRect(0, 298, PW, 3, C.red);

  // Motif décoratif (lignes diagonales légères)
  doc.save().opacity(0.04);
  for (let i = -10; i < 30; i++) {
    doc.moveTo(i * 30, 0).lineTo(i * 30 + 300, 300)
      .strokeColor(C.white).lineWidth(12).stroke();
  }
  doc.restore();

  // Logo
  if (fs.existsSync(LOGO)) {
    try { doc.image(LOGO, (PW - 88) / 2, 42, { fit: [88, 88] }); } catch (_) {}
  }

  // Titre
  doc.font("B").fontSize(28).fillColor(C.white)
    .text("Audit interne", 0, 148, { width: PW, align: "center", lineBreak: false });

  doc.font("B").fontSize(24).fillColor(C.red)
    .text("MyToolsApp mobile v2", 0, 184, { width: PW, align: "center", lineBreak: false });

  doc.font("R").fontSize(10.5).fillColor(C.gray3)
    .text("Application mobile partenaires garages", 0, 220, { width: PW, align: "center", lineBreak: false });
  doc.font("R").fontSize(10).fillColor(C.gray3)
    .text("React Native  |  Expo SDK 54  |  EAS Build", 0, 236, { width: PW, align: "center", lineBreak: false });

  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  doc.font("R").fontSize(9).fillColor(C.gray2)
    .text("Version 2.0.1  |  " + today, 0, 264, { width: PW, align: "center", lineBreak: false });

  // ── Carte equipe ────────────────────────────────────────────────────────────
  const CY = 320;
  const CH = 218;

  fillRect(ML, CY, CW, CH, C.white);
  strokeRect(ML, CY, CW, CH, C.border);
  fillRect(ML, CY, 4, CH, C.red);

  doc.font("B").fontSize(8.5).fillColor(C.red)
    .text("EQUIPE ET COMMANDITAIRE", ML + 16, CY + 14, { lineBreak: false });
  hLine(ML + 4, CY + 30, ML + CW, C.border);

  const team = [
    { label: "Redacteur",     name: "Riad BELMAHI",      role: "CTO  -  Chief Technology Officer"    },
    { label: "Direction",     name: "Iliass MEGAIZ",      role: "CEO  -  Chief Executive Officer"     },
    { label: "Commanditaire", name: "Paf Invest Limited", role: "Groupe investisseur"                 },
    { label: "President",     name: "Naime BELAMIRI",     role: "President  -  Paf Invest Limited"    },
  ];

  let ry = CY + 38;
  team.forEach((t, i) => {
    if (i % 2 === 0) fillRect(ML + 4, ry - 4, CW - 8, 36, C.bg);

    doc.font("R").fontSize(8).fillColor(C.gray2)
      .text(t.label, ML + 16, ry + 2, { width: 105, lineBreak: false });

    doc.font("S").fontSize(11).fillColor(C.text)
      .text(t.name, ML + 122, ry, { width: 175, lineBreak: false });

    doc.font("R").fontSize(8.5).fillColor(C.gray2)
      .text(t.role, ML + 305, ry + 2, { width: 175, lineBreak: false });

    ry += 42;
  });

  // ── Indicateurs ─────────────────────────────────────────────────────────────
  const IY = CY + CH + 22;
  const indicators = [
    { label: "STATUT",      value: "CONFIDENTIEL",   color: C.red       },
    { label: "EXPO-DOCTOR", value: "17/17 Check",    color: "#16A34A"   },
    { label: "EAS BUILD",   value: "Configure",      color: "#2563EB"   },
    { label: "PLATEFORMES", value: "iOS + Android",  color: C.gray1     },
  ];

  const IW = (CW - 15) / 4;
  let ix = ML;
  indicators.forEach((ind) => {
    fillRect(ix, IY, IW, 52, C.bg);
    strokeRect(ix, IY, IW, 52, C.border);
    fillRect(ix, IY, IW, 3, ind.color);

    doc.font("R").fontSize(6.5).fillColor(C.gray3)
      .text(ind.label, ix + 8, IY + 12, { width: IW - 16, lineBreak: false });
    doc.font("B").fontSize(11).fillColor(ind.color)
      .text(ind.value, ix + 8, IY + 24, { width: IW - 16, lineBreak: false });

    ix += IW + 5;
  });

  // ── Résumé sections ──────────────────────────────────────────────────────────
  const SY = IY + 52 + 20;
  fillRect(ML, SY, CW, 50, C.redLight);
  strokeRect(ML, SY, CW, 50, "#FECACA");

  doc.font("B").fontSize(8.5).fillColor(C.redDark)
    .text("CONTENU DU DOCUMENT", ML + 14, SY + 10, { lineBreak: false });
  doc.font("R").fontSize(8.5).fillColor(C.gray1)
    .text(
      "15 sections techniques  |  3 annexes  |  Architecture, Auth, API, Firebase, Base de donnees, Build EAS, Securite",
      ML + 14, SY + 26, { width: CW - 28, lineBreak: false }
    );

  // ── Pied couverture ──────────────────────────────────────────────────────────
  fillRect(0, PH - 40, PW, 40, C.dark);
  doc.font("R").fontSize(7.5).fillColor(C.gray2)
    .text(
      "Document confidentiel  -  Usage interne uniquement  -  2026 MyTools Group / Paf Invest Limited",
      0, PH - 20, { width: PW, align: "center", lineBreak: false }
    );
}

// ─── Table des matières ───────────────────────────────────────────────────────

function buildToC(sections) {
  currentSection = "Table des matieres";
  doc.addPage({ size: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  drawHeader();

  let cy = TOP + 4;

  fillRect(ML, cy, CW, 38, C.dark);
  fillRect(ML, cy + 36, CW, 2, C.red);
  doc.font("B").fontSize(16).fillColor(C.white)
    .text("Table des matieres", ML + 12, cy + 10, { lineBreak: false });
  cy += 50;

  sections.forEach((s, i) => {
    if (cy + 26 > BOT) return; // safety

    const isAnnex = s.title.startsWith("Annexe");
    const bg = isAnnex ? "#FFF7ED" : (i % 2 === 0 ? C.white : C.bg);

    fillRect(ML, cy, CW, 24, bg);
    hLine(ML, cy, ML + CW, C.border);

    // Numero + couleur
    const numColor = isAnnex ? "#D97706" : C.red;
    const num = isAnnex ? s.title.split(" ")[0] + " " + s.title.split(" ")[1] : (i + 1).toString();
    const numW = 36;

    doc.font("B").fontSize(9).fillColor(numColor)
      .text(isAnnex ? "" : String(i + 1) + ".", ML + 10, cy + 7, { width: numW, lineBreak: false });

    const title = sanitize(s.title.replace(/^\d+\.\s*/, "").replace(/^Annexe\s+[A-Z]\s+[-—]\s*/, ""));
    doc.font(isAnnex ? "I" : "R").fontSize(9.5).fillColor(C.text)
      .text(title, ML + numW + 6, cy + 7, { width: CW - numW - 50, lineBreak: false });

    // Points de conduite et numéro de page (approximatif)
    const pg = "p." + (s.pageEst || "-");
    doc.font("R").fontSize(8.5).fillColor(C.gray2)
      .text(pg, ML + CW - 28, cy + 8, { width: 28, align: "right", lineBreak: false });

    cy += 24;
  });

  hLine(ML, cy, ML + CW, C.border);
  cy += 16;

  // Note bas
  doc.font("I").fontSize(8).fillColor(C.gray2)
    .text("Les numeros de pages sont indicatifs selon la longueur des sections.", ML, cy, { width: CW });
}

// ─── Parseur Markdown ─────────────────────────────────────────────────────────

function parseMd(text) {
  const lines  = text.split("\n");
  const blocks = [];
  let inCode   = false;
  let codeBuf  = [];
  let inTable  = false;
  let tableBuf = [];

  for (const raw of lines) {
    // Code fence
    if (raw.startsWith("```")) {
      if (!inCode) { inCode = true; codeBuf = []; }
      else {
        blocks.push({ type: "code", lines: codeBuf });
        inCode = false; codeBuf = [];
      }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    // Tables
    if (raw.trim().startsWith("|")) {
      if (!inTable) { inTable = true; tableBuf = []; }
      const cells = raw.split("|").slice(1, -1).map(c => c.trim());
      if (!cells.every(c => /^[-: ]+$/.test(c))) tableBuf.push(cells);
      continue;
    }
    if (inTable) {
      blocks.push({ type: "table", rows: tableBuf });
      inTable = false; tableBuf = [];
    }

    const t = raw.trim();
    if (!t) { blocks.push({ type: "blank" }); continue; }

    if (/^#### /.test(t)) { blocks.push({ type: "h4", text: t.slice(5) }); continue; }
    if (/^### /.test(t))  { blocks.push({ type: "h3", text: t.slice(4) }); continue; }
    if (/^## /.test(t))   { blocks.push({ type: "h2", text: t.slice(3) }); continue; }
    if (/^# /.test(t))    { blocks.push({ type: "h1", text: t.slice(2) }); continue; }

    if (/^(-{3,}|={3,})$/.test(t)) { blocks.push({ type: "hr" }); continue; }
    if (/^[-*+] /.test(t)) { blocks.push({ type: "li", text: t.replace(/^[-*+] /, "") }); continue; }
    if (/^\d+\. /.test(t)) { blocks.push({ type: "li", text: t.replace(/^\d+\. /, "") }); continue; }
    if (t.startsWith(">")) { blocks.push({ type: "blockquote", text: t.replace(/^>\s*/, "") }); continue; }

    blocks.push({ type: "p", text: t });
  }

  if (inTable) blocks.push({ type: "table", rows: tableBuf });
  if (inCode)  blocks.push({ type: "code",  lines: codeBuf  });

  return blocks;
}

// ─── Moteur de rendu ──────────────────────────────────────────────────────────

let curY    = TOP;
let pageNum = 1; // couverture + ToC = pages 1-2

function newPage() {
  doc.addPage({ size: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  pageNum++;
  drawHeader();
  curY = TOP;
}

function need(h) {
  if (curY + h > BOT) newPage();
}

function renderBlocks(blocks) {
  let prev = "";

  for (const b of blocks) {
    if (b.type === "blank") {
      if (prev !== "blank" && prev !== "h2" && prev !== "h1") curY += 4;
      prev = "blank";
      continue;
    }

    switch (b.type) {

      // H1 — titre document (ignoré, couverture déjà faite)
      case "h1":
        break;

      // H2 — section principale → nouvelle page
      case "h2": {
        const title = stripMd(b.text);
        const isSubtitle = /^MyToolsApp/.test(title) || /^Table/.test(title);

        if (!isSubtitle) {
          newPage();
          currentSection = title;
        }

        need(50);
        fillRect(ML - 2, curY, CW + 4, 44, C.dark);
        fillRect(ML - 2, curY + 42, CW + 4, 2, C.red);

        doc.font("B").fontSize(16).fillColor(C.white)
          .text(title, ML + 10, curY + 13, { width: CW - 16, lineBreak: false });
        curY += 58;
        break;
      }

      // H3
      case "h3": {
        const title = stripMd(b.text);
        need(40);
        curY += 10;

        fillRect(ML, curY, CW, 30, C.redLight);
        fillRect(ML, curY, 4, 30, C.red);

        doc.font("B").fontSize(11.5).fillColor(C.redDark)
          .text(title, ML + 14, curY + 8, { width: CW - 20, lineBreak: false });
        curY += 42;
        break;
      }

      // H4
      case "h4": {
        const title = stripMd(b.text);
        need(28);
        curY += 6;
        doc.font("S").fontSize(10).fillColor(C.red)
          .text(title, ML, curY, { width: CW, lineBreak: false });
        curY += 16;
        hLine(ML, curY, ML + 44, C.red, 1.5);
        curY += 8;
        break;
      }

      // Paragraphe
      case "p": {
        const txt = stripMd(b.text);
        if (!txt) break;
        const h = doc.heightOfString(txt, { font: "R", size: 9.5, width: CW }) + 6;
        need(h);
        doc.font("R").fontSize(9.5).fillColor(C.text)
          .text(txt, ML, curY, { width: CW, lineGap: 3 });
        curY = doc.y + 5;
        break;
      }

      // Liste
      case "li": {
        const txt = stripMd(b.text);
        const h   = doc.heightOfString(txt, { font: "R", size: 9.5, width: CW - 18 }) + 4;
        need(h + 4);

        doc.save().circle(ML + 5, curY + 6, 2.5).fill(C.red).restore();
        doc.font("R").fontSize(9.5).fillColor(C.text)
          .text(txt, ML + 15, curY, { width: CW - 15, lineGap: 3 });
        curY = doc.y + 3;
        break;
      }

      // Blockquote
      case "blockquote": {
        const txt = stripMd(b.text);
        const h   = doc.heightOfString(txt, { font: "I", size: 9.5, width: CW - 24 }) + 12;
        need(h + 6);
        curY += 4;

        fillRect(ML, curY, CW, h, C.bg);
        fillRect(ML, curY, 3, h, C.gray2);
        doc.font("I").fontSize(9.5).fillColor(C.gray1)
          .text(txt, ML + 12, curY + 6, { width: CW - 20, lineGap: 3 });
        curY += h + 6;
        break;
      }

      // Bloc de code
      case "code": {
        if (!b.lines || b.lines.length === 0) break;

        // Sanitiser et reformater chaque ligne
        const cleanLines = b.lines.map(l => sanitize(l));
        const lineH = 11.5;

        let remaining = [...cleanLines];
        while (remaining.length > 0) {
          const available  = BOT - curY - 16;
          const canFit     = Math.max(2, Math.floor(available / lineH));
          const chunk      = remaining.splice(0, canFit);
          const blockH     = chunk.length * lineH + 18;

          need(blockH);
          curY += 4;

          fillRect(ML, curY, CW, blockH, C.codeBg);
          strokeRect(ML, curY, CW, blockH, C.border);
          fillRect(ML, curY, 3, blockH, C.red);

          let ly = curY + 9;
          chunk.forEach((l) => {
            doc.font("R").fontSize(8).fillColor(C.gray1)
              .text(l || " ", ML + 10, ly, { width: CW - 18, lineBreak: false });
            ly += lineH;
          });

          curY = ly + 8;
          if (remaining.length > 0) newPage();
        }
        break;
      }

      // Tableau
      case "table": {
        if (!b.rows || b.rows.length < 2) break;

        const header   = b.rows[0];
        const dataRows = b.rows.slice(1);
        const cols     = header.length;
        const rowH     = 24;

        // Calculer largeurs de colonnes selon contenu
        const colWidths = header.map(() => CW / cols);

        const totalH = (1 + dataRows.length) * rowH;
        need(totalH + 12);
        curY += 6;

        let ty = curY;

        // Header
        fillRect(ML, ty, CW, rowH, C.dark);
        let hx = ML;
        header.forEach((cell, ci) => {
          doc.font("B").fontSize(8.5).fillColor(C.white)
            .text(stripMd(cell), hx + 6, ty + 7, { width: colWidths[ci] - 12, lineBreak: false });
          hx += colWidths[ci];
        });
        ty += rowH;

        // Rows
        dataRows.forEach((row, ri) => {
          if (ty + rowH > BOT) { newPage(); ty = curY; }

          const bg = ri % 2 === 0 ? C.white : C.bg;
          fillRect(ML, ty, CW, rowH, bg);
          hLine(ML, ty, ML + CW, C.border);

          let rx = ML;
          row.forEach((cell, ci) => {
            const isFirst = ci === 0;
            doc.font(isFirst ? "S" : "R").fontSize(8.5)
              .fillColor(isFirst ? C.text : C.gray1)
              .text(stripMd(cell), rx + 6, ty + 7, { width: colWidths[ci] - 12, lineBreak: false });
            rx += colWidths[ci];
          });
          ty += rowH;
        });

        strokeRect(ML, curY, CW, ty - curY, C.gray1, 0.5);
        curY = ty + 10;
        break;
      }

      // HR
      case "hr": {
        need(14);
        curY += 5;
        hLine(ML, curY, ML + CW, C.border);
        curY += 9;
        break;
      }
    }

    prev = b.type;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("  Lecture de AUDIT.md...");
const mdRaw = fs.readFileSync(MD, "utf8");
const allBlocks = parseMd(mdRaw);

// Extraire les sections pour la table des matières
const sections = allBlocks
  .filter(b => b.type === "h2")
  .map((b, i) => ({ title: stripMd(b.text), pageEst: i + 3 }))
  .filter(s => !/^MyToolsApp/.test(s.title) && !/^Table/.test(s.title));

console.log("  Sections trouvees : " + sections.length);

console.log("  Generation de la couverture...");
buildCover();

console.log("  Generation de la table des matieres...");
buildToC(sections);

console.log("  Rendu du contenu...");
newPage();
renderBlocks(allBlocks);

// ── Numérotation finale ───────────────────────────────────────────────────────
const range = doc.bufferedPageRange();
const total = range.count;

console.log("  Pagination : " + total + " pages");

for (let i = 0; i < total; i++) {
  doc.switchToPage(i);
  if (i === 0) continue; // couverture sans pied
  drawFooter(i + 1, total);
}

doc.end();
doc.once("end", () => {
  const kb = (fs.statSync(OUTPUT).size / 1024).toFixed(0);
  console.log("\n  PDF : " + OUTPUT);
  console.log("  " + total + " pages  |  " + kb + " Ko");
});
