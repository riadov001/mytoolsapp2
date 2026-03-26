#!/usr/bin/env node
/**
 * Génération PDF — Audit interne MyToolsApp mobile v2
 * Police : Exo 2 | Thème : MyTools Group
 */

"use strict";

const PDFDocument = require("pdfkit");
const fs          = require("fs");
const path        = require("path");

// ─── Chemins ─────────────────────────────────────────────────────────────────
const ROOT   = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "AUDIT_MyToolsApp_v2.pdf");
const LOGO   = path.join(ROOT, "assets/images/logo_new.png");
const MD     = path.join(ROOT, "AUDIT.md");
const FONTS  = path.join(__dirname, "fonts");

const F = {
  Regular:  path.join(FONTS, "Exo2-Regular.woff"),
  Bold:     path.join(FONTS, "Exo2-Bold.woff"),
  SemiBold: path.join(FONTS, "Exo2-SemiBold.woff"),
  Italic:   path.join(FONTS, "Exo2-Italic.woff"),
};

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  red:       "#DC2626",
  redDark:   "#991B1B",
  redLight:  "#FFF1F1",
  dark:      "#111827",
  darkCard:  "#1F2937",
  midGray:   "#6B7280",
  border:    "#E5E7EB",
  bg:        "#F9FAFB",
  text:      "#1F2937",
  white:     "#FFFFFF",
};

// ─── Dimensions ───────────────────────────────────────────────────────────────
const PW     = 595.28;   // A4 largeur
const PH     = 841.89;   // A4 hauteur
const ML     = 52;       // marge gauche
const MR     = 52;       // marge droite
const CW     = PW - ML - MR; // largeur contenu
const HDR_H  = 42;       // hauteur en-tête
const FTR_H  = 36;       // hauteur pied de page
const TOP    = HDR_H + 14; // Y de début contenu
const BOT    = PH - FTR_H - 10; // Y de fin contenu

// ─── Document ─────────────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: "A4",
  autoFirstPage: false,
  bufferPages: true,
  info: {
    Title:    "Audit interne MyToolsApp mobile v2",
    Author:   "Riad BELMAHI — CTO, MyTools Group",
    Subject:  "Audit de code — Application mobile partenaires garages",
    Creator:  "MyTools Group / Paf Invest Limited",
    Keywords: "audit, mobile, expo, react-native, mytoolsapp",
  },
});

// Enregistrer les polices
doc.registerFont("Regular",  F.Regular);
doc.registerFont("Bold",     F.Bold);
doc.registerFont("SemiBold", F.SemiBold);
doc.registerFont("Italic",   F.Italic);

doc.pipe(fs.createWriteStream(OUTPUT));

// ─── Utilitaires bas niveau ───────────────────────────────────────────────────

function rect(x, y, w, h, fill, stroke) {
  doc.save();
  doc.rect(x, y, w, h);
  if (fill)   doc.fill(fill);
  if (stroke) doc.stroke(stroke);
  doc.restore();
}

function line(x1, y1, x2, y2, color = C.border, lw = 0.5) {
  doc.save().moveTo(x1, y1).lineTo(x2, y2)
    .strokeColor(color).lineWidth(lw).stroke().restore();
}

// Nettoyer le markdown inline (gras, italique, code, liens)
function clean(str = "") {
  return str
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\\([*_`])/g, "$1")
    .trim();
}

// ─── En-tête & pied de page ───────────────────────────────────────────────────

function drawPageHeader(section = "") {
  rect(0, 0, PW, HDR_H, C.dark);
  rect(0, HDR_H - 2, PW, 2, C.red);

  if (fs.existsSync(LOGO)) {
    try { doc.image(LOGO, ML, 9, { height: 24, fit: [24, 24] }); } catch (_) {}
  }

  doc.font("Bold").fontSize(9).fillColor(C.white)
    .text("Audit interne MyToolsApp mobile v2", ML + 32, 11, { lineBreak: false });

  doc.font("Regular").fontSize(7.5).fillColor("#9CA3AF")
    .text("CONFIDENTIEL — Paf Invest Limited", ML + 32, 23, { lineBreak: false });

  if (section) {
    const sw = doc.widthOfString(section, { font: "Regular", size: 7.5 });
    doc.font("Regular").fontSize(7.5).fillColor("#9CA3AF")
      .text(section, PW - MR - sw - 4, 20, { lineBreak: false });
  }
}

function drawPageFooter(pageNum, total) {
  rect(0, PH - FTR_H, PW, FTR_H, C.bg);
  line(0, PH - FTR_H, PW, PH - FTR_H, C.border, 0.5);

  doc.font("Regular").fontSize(7).fillColor(C.midGray)
    .text(
      "Riad BELMAHI (CTO)  \u2022  Iliass MEGAIZ (CEO)  \u2022  Paf Invest Limited  \u2022  Pr\u00e9sident : Naime BELAMIRI",
      ML, PH - FTR_H + 12,
      { lineBreak: false }
    );

  const pStr = `${pageNum} / ${total}`;
  const pw2  = doc.widthOfString(pStr, { font: "Bold", size: 9 });
  doc.font("Bold").fontSize(9).fillColor(C.red)
    .text(pStr, PW - MR - pw2, PH - FTR_H + 10, { lineBreak: false });
}

// ─── Page de couverture ───────────────────────────────────────────────────────

function buildCover() {
  doc.addPage({ size: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  // Fond sombre haut
  rect(0, 0, PW, 340, C.dark);
  rect(0, 338, PW, 3, C.red);

  // Logo
  if (fs.existsSync(LOGO)) {
    try { doc.image(LOGO, (PW - 100) / 2, 44, { fit: [100, 100] }); } catch (_) {}
  }

  // Titre principal
  doc.font("Bold").fontSize(30).fillColor(C.white)
    .text("Audit interne", ML, 162, { width: CW, align: "center", lineBreak: false });

  doc.font("Bold").fontSize(26).fillColor(C.red)
    .text("MyToolsApp mobile v2", ML, 197, { width: CW, align: "center", lineBreak: false });

  doc.font("Regular").fontSize(11).fillColor("#9CA3AF")
    .text(
      "Application mobile partenaires garages\nReact Native \u2022 Expo SDK 54 \u2022 EAS Build",
      ML, 236, { width: CW, align: "center" }
    );

  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  doc.font("Regular").fontSize(9).fillColor("#6B7280")
    .text("Version 2.0.1  \u2022  " + today, ML, 284, { width: CW, align: "center", lineBreak: false });

  // ── Carte equipe ──────────────────────────────────────────────────────────
  const CY = 358;
  const CH = 210;
  rect(ML - 1, CY - 1, CW + 2, CH + 2, null, C.border);
  rect(ML,     CY,     CW,     CH,     C.white);
  rect(ML,     CY,     4,      CH,     C.red);

  doc.font("Bold").fontSize(9).fillColor(C.red)
    .text("\u00c9QUIPE ET COMMANDITAIRE", ML + 16, CY + 14, { lineBreak: false });
  line(ML + 4, CY + 30, ML + CW, CY + 30, C.border);

  const team = [
    { label: "R\u00e9dacteur",   name: "Riad BELMAHI",       role: "CTO — Chief Technology Officer" },
    { label: "Direction",        name: "Iliass MEGAIZ",       role: "CEO — Chief Executive Officer"  },
    { label: "Commanditaire",    name: "Paf Invest Limited",  role: "Groupe investisseur"            },
    { label: "Pr\u00e9sident",   name: "Naime BELAMIRI",      role: "Pr\u00e9sident — Paf Invest Limited" },
  ];

  let ry = CY + 38;
  team.forEach((t, i) => {
    if (i % 2 === 0) rect(ML + 4, ry - 3, CW - 8, 34, "#F9FAFB");
    doc.font("Regular").fontSize(8).fillColor(C.midGray)
      .text(t.label, ML + 16, ry + 2, { lineBreak: false });
    doc.font("SemiBold").fontSize(11).fillColor(C.text)
      .text(t.name, ML + 120, ry, { lineBreak: false });
    doc.font("Regular").fontSize(9).fillColor(C.midGray)
      .text(t.role, ML + 300, ry + 2, { lineBreak: false });
    ry += 40;
  });

  // ── Badges statut ─────────────────────────────────────────────────────────
  const BY = CY + CH + 24;
  const badges = [
    { label: "Statut",       value: "CONFIDENTIEL",  color: C.red       },
    { label: "expo-doctor",  value: "17/17  \u2713", color: "#16A34A"   },
    { label: "EAS Build",    value: "Configur\u00e9", color: "#2563EB"  },
    { label: "Plateformes",  value: "iOS + Android", color: C.dark      },
  ];
  const BW = (CW - 15) / 4;
  let bx = ML;
  badges.forEach((b) => {
    rect(bx, BY,      BW, 56,  C.bg,    C.border);
    rect(bx, BY,      BW, 4,   b.color);
    doc.font("Regular").fontSize(7).fillColor(C.midGray)
      .text(b.label.toUpperCase(), bx + 8, BY + 12, { width: BW - 16, lineBreak: false });
    doc.font("Bold").fontSize(12).fillColor(b.color)
      .text(b.value, bx + 8, BY + 24, { width: BW - 16, lineBreak: false });
    bx += BW + 5;
  });

  // ── Pied couverture ───────────────────────────────────────────────────────
  rect(0, PH - 44, PW, 44, C.dark);
  doc.font("Regular").fontSize(7.5).fillColor("#6B7280")
    .text(
      "Document confidentiel \u2014 Usage interne uniquement \u2014 \u00a9 2026 MyTools Group / Paf Invest Limited",
      ML, PH - 24, { width: CW, align: "center", lineBreak: false }
    );
}

// ─── Parseur Markdown simplifié ───────────────────────────────────────────────

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

    // Table rows
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
    if (!t)              { blocks.push({ type: "blank" });             continue; }
    if (/^#{4}\s/.test(t)) { blocks.push({ type:"h4", text: t.replace(/^#{4}\s/, "") }); continue; }
    if (/^#{3}\s/.test(t)) { blocks.push({ type:"h3", text: t.replace(/^#{3}\s/, "") }); continue; }
    if (/^#{2}\s/.test(t)) { blocks.push({ type:"h2", text: t.replace(/^#{2}\s/, "") }); continue; }
    if (/^#\s/.test(t))    { blocks.push({ type:"h1", text: t.replace(/^#\s/,  "") }); continue; }
    if (/^(-{3,}|={3,})$/.test(t)) { blocks.push({ type: "hr" }); continue; }
    if (/^[-*+]\s/.test(t)) { blocks.push({ type: "li", text: t.replace(/^[-*+]\s/, "") }); continue; }
    if (/^\d+\.\s/.test(t)) { blocks.push({ type: "li", text: t.replace(/^\d+\.\s/, "") }); continue; }
    blocks.push({ type: "p", text: t });
  }
  if (inTable) blocks.push({ type: "table", rows: tableBuf });
  if (inCode)  blocks.push({ type: "code", lines: codeBuf });
  return blocks;
}

// ─── Moteur de rendu ──────────────────────────────────────────────────────────

let curSection = "";
let curY       = TOP;
let pageNum    = 1;   // couverture = 1

function newContentPage() {
  doc.addPage({ size: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  pageNum++;
  drawPageHeader(curSection);
  curY = TOP;
}

function ensureSpace(needed) {
  if (curY + needed > BOT) newContentPage();
}

// Mesurer la hauteur d'un bloc de texte
function textHeight(text, opts) {
  return doc.heightOfString(text, opts);
}

function renderBlocks(blocks) {
  let prevType = "";

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    // Absorber les blanks consécutifs
    if (b.type === "blank") {
      if (prevType !== "blank" && prevType !== "h1" && prevType !== "h2")
        curY += 5;
      prevType = "blank";
      continue;
    }

    switch (b.type) {

      // ── H1 : nouvelle page, bloc sombre complet ──────────────────────────
      case "h1": {
        const title = clean(b.text);
        curSection  = title;
        newContentPage();

        rect(ML - 2, curY, CW + 4, 46, C.dark);
        rect(ML - 2, curY + 44, CW + 4, 3, C.red);

        doc.font("Bold").fontSize(18).fillColor(C.white)
          .text(title, ML + 10, curY + 12, { width: CW - 20, lineBreak: false });

        curY += 58;
        break;
      }

      // ── H2 : bloc rouge clair + barre gauche ────────────────────────────
      case "h2": {
        const title = clean(b.text);
        const th    = Math.max(34, textHeight(title, { font:"Bold", size:13, width: CW - 28 }) + 16);
        ensureSpace(th + 16);
        curY += 10;
        rect(ML, curY, CW, th, C.redLight);
        rect(ML, curY, 4,  th, C.red);
        doc.font("Bold").fontSize(13).fillColor(C.redDark)
          .text(title, ML + 14, curY + (th - 13) / 2, { width: CW - 20, lineBreak: false });
        curY += th + 10;
        break;
      }

      // ── H3 ───────────────────────────────────────────────────────────────
      case "h3": {
        const title = clean(b.text);
        ensureSpace(32);
        curY += 8;
        doc.font("Bold").fontSize(11).fillColor(C.text)
          .text(title, ML, curY, { width: CW });
        curY = doc.y + 2;
        line(ML, curY, ML + 50, curY, C.red, 1.5);
        curY += 8;
        break;
      }

      // ── H4 ───────────────────────────────────────────────────────────────
      case "h4": {
        const title = clean(b.text);
        ensureSpace(22);
        curY += 4;
        doc.font("SemiBold").fontSize(10).fillColor(C.red)
          .text(title.toUpperCase(), ML, curY, { width: CW });
        curY = doc.y + 4;
        break;
      }

      // ── Paragraphe ────────────────────────────────────────────────────────
      case "p": {
        const txt = clean(b.text);
        if (!txt) break;
        const h = textHeight(txt, { font:"Regular", size:9.5, width: CW });
        ensureSpace(h + 6);
        doc.font("Regular").fontSize(9.5).fillColor(C.text)
          .text(txt, ML, curY, { width: CW, lineGap: 2.5 });
        curY = doc.y + 5;
        break;
      }

      // ── Liste ─────────────────────────────────────────────────────────────
      case "li": {
        const txt = clean(b.text);
        const h   = textHeight(txt, { font:"Regular", size:9.5, width: CW - 18 }) + 4;
        ensureSpace(h + 4);

        // Puce rouge
        doc.save().circle(ML + 5, curY + 6, 2.8).fill(C.red).restore();

        doc.font("Regular").fontSize(9.5).fillColor(C.text)
          .text(txt, ML + 15, curY, { width: CW - 15, lineGap: 2.5 });
        curY = doc.y + 3;
        break;
      }

      // ── Bloc de code ──────────────────────────────────────────────────────
      case "code": {
        const codeStr = b.lines.join("\n");
        const lineH   = 12;
        const blockH  = b.lines.length * lineH + 20;

        // Si trop grand, paginer
        let remaining = [...b.lines];
        while (remaining.length > 0) {
          const available = BOT - curY - 20;
          const canFit    = Math.max(1, Math.floor(available / lineH));
          const chunk     = remaining.splice(0, canFit);
          const chunkH    = chunk.length * lineH + 20;

          ensureSpace(chunkH);
          rect(ML,     curY, CW,  chunkH, "#F3F4F6", C.border);
          rect(ML,     curY, 3,   chunkH, C.red);

          let cy = curY + 10;
          chunk.forEach((l) => {
            doc.font("Regular").fontSize(8).fillColor("#374151")
              .text(l || " ", ML + 10, cy, { width: CW - 18, lineBreak: false });
            cy += lineH;
          });
          curY = cy + 10;
          if (remaining.length > 0) newContentPage();
        }
        break;
      }

      // ── Tableau ───────────────────────────────────────────────────────────
      case "table": {
        if (!b.rows || b.rows.length < 2) break;

        const header   = b.rows[0];
        const dataRows = b.rows.slice(1);
        const cols     = header.length;
        const colW     = CW / cols;
        const rowH     = 22;
        const totalH   = (b.rows.length) * rowH;

        ensureSpace(totalH + 10);
        curY += 6;

        let ty = curY;

        // En-tête tableau
        rect(ML, ty, CW, rowH, C.dark);
        header.forEach((cell, ci) => {
          doc.font("Bold").fontSize(8.5).fillColor(C.white)
            .text(clean(cell), ML + ci * colW + 6, ty + 6,
              { width: colW - 12, lineBreak: false });
        });
        ty += rowH;

        // Lignes de données
        dataRows.forEach((row, ri) => {
          if (ty + rowH > BOT) { newContentPage(); ty = curY; }

          const bg = ri % 2 === 0 ? C.white : C.bg;
          rect(ML, ty, CW, rowH, bg, C.border);

          row.forEach((cell, ci) => {
            const isFirst = ci === 0;
            const font    = isFirst ? "SemiBold" : "Regular";
            const color   = isFirst ? C.text     : C.midGray;
            doc.font(font).fontSize(8.5).fillColor(color)
              .text(clean(cell), ML + ci * colW + 6, ty + 6,
                { width: colW - 12, lineBreak: false });
          });
          ty += rowH;
        });

        // Bordure globale tableau
        doc.save().rect(ML, curY, CW, ty - curY).stroke(C.midGray).restore();
        curY = ty + 10;
        break;
      }

      // ── Séparateur ────────────────────────────────────────────────────────
      case "hr": {
        ensureSpace(16);
        curY += 6;
        line(ML, curY, ML + CW, curY, C.border, 0.5);
        curY += 10;
        break;
      }
    }

    prevType = b.type;
  }
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

console.log("  Lecture AUDIT.md...");
const mdRaw    = fs.readFileSync(MD, "utf8");

// Supprimer le bloc titre de couverture (5 premières lignes avec les méta)
const mdClean  = mdRaw.replace(/^#[^\n]+\n[\s\S]{0,300}?(?=\n##)/m, "");
const blocks   = parseMd(mdClean);

console.log("  Génération de la couverture...");
buildCover();

console.log("  Rendu des sections (" + blocks.filter(b => b.type === "h1").length + " sections)...");
newContentPage();
renderBlocks(blocks);

// ─── Injection numéros de page + en-têtes/pieds ───────────────────────────────
const range = doc.bufferedPageRange();
const total = range.count;

console.log("  Pagination (" + total + " pages)...");

for (let i = 0; i < total; i++) {
  doc.switchToPage(i);
  if (i === 0) continue; // couverture : pas de pied standard
  drawPageFooter(i + 1, total);
}

doc.end();

doc.once("end", () => {
  const kb = (fs.statSync(OUTPUT).size / 1024).toFixed(0);
  console.log("\n  PDF genere : " + OUTPUT);
  console.log("  " + total + " pages  |  " + kb + " Ko");
});
