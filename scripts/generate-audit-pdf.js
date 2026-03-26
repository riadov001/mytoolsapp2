#!/usr/bin/env node
/**
 * Génération PDF — Audit interne MyToolsApp mobile v2
 * Auteur script : MyTools Group
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "../AUDIT_MyToolsApp_v2.pdf");
const LOGO = path.join(__dirname, "../assets/images/logo_new.png");
const AUDIT_MD = path.join(__dirname, "../AUDIT.md");

// ─── Palette de couleurs (thème app) ────────────────────────────────────────
const C = {
  red:        "#DC2626",
  redDark:    "#991B1B",
  redLight:   "#FEE2E2",
  dark:       "#0A0A0A",
  darkGray:   "#1C1C1E",
  midGray:    "#3A3A3C",
  lightGray:  "#F5F5F7",
  borderGray: "#E5E7EB",
  text:       "#111827",
  textLight:  "#6B7280",
  white:      "#FFFFFF",
  accent:     "#1D4ED8",
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Créer le document ───────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: "A4",
  margins: { top: MARGIN, bottom: 60, left: MARGIN, right: MARGIN },
  info: {
    Title: "Audit interne MyToolsApp mobile v2",
    Author: "Riad BELMAHI — CTO, MyTools Group",
    Subject: "Audit de code — Application mobile partenaires garages",
    Creator: "MyTools Group",
    Producer: "PDFKit",
  },
  bufferPages: true,
});

doc.pipe(fs.createWriteStream(OUTPUT));

let pageCount = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function newPage() {
  doc.addPage();
  pageCount++;
}

function fillRect(x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

function hRule(y, color = C.borderGray, width = CONTENT_W) {
  doc.save()
    .moveTo(MARGIN, y).lineTo(MARGIN + width, y)
    .strokeColor(color).lineWidth(0.5).stroke()
    .restore();
}

function badge(text, x, y, bg = C.red, fg = C.white) {
  const pad = 6;
  const fw = doc.widthOfString(text, { size: 8 }) + pad * 2;
  const fh = 16;
  doc.save()
    .roundedRect(x, y, fw, fh, 3).fill(bg)
    .fontSize(8).fillColor(fg).font("Helvetica-Bold")
    .text(text, x + pad, y + 4, { width: fw - pad * 2, align: "center" })
    .restore();
  return fw;
}

// ─── Page de couverture ──────────────────────────────────────────────────────

function drawCover() {
  pageCount = 1;

  // Fond header sombre
  fillRect(0, 0, PAGE_W, 320, C.dark);

  // Bande rouge en bas du header
  fillRect(0, 308, PAGE_W, 12, C.red);

  // Logo centré dans le header
  const logoSize = 90;
  const logoX = (PAGE_W - logoSize) / 2;
  if (fs.existsSync(LOGO)) {
    doc.image(LOGO, logoX, 50, { width: logoSize, height: logoSize, fit: [logoSize, logoSize], align: "center" });
  }

  // Titre
  doc.fontSize(28).font("Helvetica-Bold").fillColor(C.white)
    .text("Audit interne", MARGIN, 170, { width: CONTENT_W, align: "center" });
  doc.fontSize(22).font("Helvetica-Bold").fillColor(C.red)
    .text("MyToolsApp mobile v2", MARGIN, 205, { width: CONTENT_W, align: "center" });

  // Sous-titre
  doc.fontSize(11).font("Helvetica").fillColor("#9CA3AF")
    .text("Application mobile partenaires garages — React Native / Expo SDK 54", MARGIN, 245, {
      width: CONTENT_W, align: "center",
    });

  // Date + version
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  doc.fontSize(9).fillColor("#6B7280")
    .text(`Version 2.0.1  •  ${dateStr}`, MARGIN, 275, { width: CONTENT_W, align: "center" });

  // ── Bloc équipe ──
  const cardY = 345;
  const cardH = 195;

  // Ombre / bordure card
  fillRect(MARGIN - 1, cardY - 1, CONTENT_W + 2, cardH + 2, C.borderGray);
  fillRect(MARGIN, cardY, CONTENT_W, cardH, C.white);

  // Bande rouge gauche
  fillRect(MARGIN, cardY, 4, cardH, C.red);

  // Titre card
  doc.fontSize(10).font("Helvetica-Bold").fillColor(C.red)
    .text("ÉQUIPE & COMMANDITAIRE", MARGIN + 18, cardY + 14);
  hRule(cardY + 32, C.borderGray, CONTENT_W - 18);

  // Lignes équipe
  const rows = [
    { label: "Rédacteur", value: "Riad BELMAHI", role: "CTO — Chief Technology Officer" },
    { label: "Direction", value: "Iliass MEGAIZ", role: "CEO — Chief Executive Officer" },
    { label: "Commanditaire", value: "Paf Invest Limited", role: "Groupe investisseur" },
    { label: "Président", value: "Naime BELAMIRI", role: "Président — Paf Invest Limited" },
  ];

  let ry = cardY + 42;
  rows.forEach((r, i) => {
    if (i % 2 === 0) fillRect(MARGIN + 4, ry - 2, CONTENT_W - 8, 30, "#FAFAFA");
    doc.fontSize(8).font("Helvetica").fillColor(C.textLight)
      .text(r.label.toUpperCase(), MARGIN + 18, ry + 2, { width: 90 });
    doc.fontSize(11).font("Helvetica-Bold").fillColor(C.text)
      .text(r.value, MARGIN + 115, ry, { width: 180 });
    doc.fontSize(9).font("Helvetica").fillColor(C.textLight)
      .text(r.role, MARGIN + 300, ry + 2, { width: 220 });
    ry += 38;
  });

  // ── Bloc statut ──
  const statY = cardY + cardH + 22;
  const statItems = [
    { label: "Statut", val: "CONFIDENTIEL", color: C.red },
    { label: "expo-doctor", val: "17/17 ✓", color: "#16A34A" },
    { label: "EAS Build", val: "Configuré", color: "#2563EB" },
    { label: "Plateforme", val: "iOS + Android", color: C.midGray },
  ];

  let sx = MARGIN;
  const boxW = (CONTENT_W - 15) / 4;
  statItems.forEach((s) => {
    fillRect(sx, statY, boxW, 52, C.lightGray);
    doc.save().rect(sx, statY, boxW, 52).stroke(C.borderGray).restore();
    fillRect(sx, statY, boxW, 4, s.color);
    doc.fontSize(7).font("Helvetica").fillColor(C.textLight)
      .text(s.label.toUpperCase(), sx + 8, statY + 12, { width: boxW - 16 });
    doc.fontSize(11).font("Helvetica-Bold").fillColor(s.color)
      .text(s.val, sx + 8, statY + 24, { width: boxW - 16 });
    sx += boxW + 5;
  });

  // ── Ligne de pied de couverture ──
  fillRect(0, PAGE_H - 48, PAGE_W, 48, C.darkGray);
  doc.fontSize(8).font("Helvetica").fillColor("#6B7280")
    .text("Document confidentiel — Usage interne uniquement — © 2026 MyTools Group / Paf Invest Limited",
      MARGIN, PAGE_H - 28, { width: CONTENT_W, align: "center" });
}

// ─── En-tête de page courante ─────────────────────────────────────────────────

function drawHeader(sectionTitle = "") {
  fillRect(0, 0, PAGE_W, 38, C.dark);
  fillRect(0, 36, PAGE_W, 2, C.red);

  if (fs.existsSync(LOGO)) {
    doc.image(LOGO, MARGIN, 7, { height: 22, fit: [22, 22] });
  }

  doc.fontSize(8).font("Helvetica-Bold").fillColor(C.white)
    .text("Audit interne MyToolsApp mobile v2", MARGIN + 30, 10);
  doc.fontSize(7).font("Helvetica").fillColor("#9CA3AF")
    .text("CONFIDENTIEL — Paf Invest Limited", MARGIN + 30, 22);

  if (sectionTitle) {
    doc.fontSize(8).font("Helvetica").fillColor("#9CA3AF")
      .text(sectionTitle, 0, 14, { width: PAGE_W - MARGIN, align: "right" });
  }
}

function drawFooter(pageNum) {
  fillRect(0, PAGE_H - 36, PAGE_W, 36, C.lightGray);
  hRule(PAGE_H - 36, C.borderGray);

  doc.fontSize(7).font("Helvetica").fillColor(C.textLight)
    .text("Riad BELMAHI — CTO  •  Iliass MEGAIZ — CEO  •  Paf Invest Limited  •  Président : Naime BELAMIRI",
      MARGIN, PAGE_H - 22, { width: CONTENT_W - 40, align: "left" });
  doc.fontSize(8).font("Helvetica-Bold").fillColor(C.red)
    .text(`${pageNum}`, PAGE_W - MARGIN - 20, PAGE_H - 22, { width: 20, align: "right" });
}

// ─── Parser le Markdown ──────────────────────────────────────────────────────

function parseMd(mdText) {
  const lines = mdText.split("\n");
  const blocks = [];

  let inTable = false;
  let tableRows = [];
  let inCode = false;
  let codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeLines = [];
      } else {
        blocks.push({ type: "code", content: codeLines.join("\n") });
        inCode = false;
        codeLines = [];
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    // Table
    if (line.startsWith("|")) {
      if (!inTable) { inTable = true; tableRows = []; }
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue; // separator row
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      blocks.push({ type: "table", rows: tableRows });
      inTable = false;
      tableRows = [];
    }

    // Headings
    if (line.startsWith("#### ")) { blocks.push({ type: "h4", content: line.slice(5) }); continue; }
    if (line.startsWith("### "))  { blocks.push({ type: "h3", content: line.slice(4) }); continue; }
    if (line.startsWith("## "))   { blocks.push({ type: "h2", content: line.slice(3) }); continue; }
    if (line.startsWith("# "))    { blocks.push({ type: "h1", content: line.slice(2) }); continue; }

    // HR
    if (/^---+$/.test(line.trim())) { blocks.push({ type: "hr" }); continue; }

    // List
    if (/^[-*]\s/.test(line)) { blocks.push({ type: "li", content: line.replace(/^[-*]\s/, "") }); continue; }
    if (/^\d+\.\s/.test(line)) { blocks.push({ type: "li", content: line.replace(/^\d+\.\s/, "") }); continue; }

    // Blank
    if (line.trim() === "") { blocks.push({ type: "blank" }); continue; }

    // Paragraph
    blocks.push({ type: "p", content: line });
  }

  if (inTable) blocks.push({ type: "table", rows: tableRows });
  if (inCode) blocks.push({ type: "code", content: codeLines.join("\n") });

  return blocks;
}

function stripMdInline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s/, "");
}

// ─── Rendu du contenu ────────────────────────────────────────────────────────

function renderBlocks(blocks) {
  let currentSection = "";
  let lastType = "";
  let blankCount = 0;

  const BODY_TOP = 55;
  const BODY_BOTTOM = PAGE_H - 45;

  function checkPageBreak(needed = 20) {
    if (doc.y + needed > BODY_BOTTOM) {
      newPage();
      drawHeader(currentSection);
      doc.y = BODY_TOP;
    }
  }

  doc.y = BODY_TOP;

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];

    if (b.type === "blank") {
      blankCount++;
      if (blankCount <= 1 && lastType !== "blank") doc.y += 4;
      continue;
    }
    blankCount = 0;

    switch (b.type) {

      case "h1": {
        // Nouvelle page pour chaque section principale (sauf la première)
        if (lastType !== "" && lastType !== "hr") {
          newPage();
          drawHeader(stripMdInline(b.content));
          doc.y = BODY_TOP;
        }
        currentSection = stripMdInline(b.content);

        checkPageBreak(60);
        fillRect(MARGIN, doc.y, CONTENT_W, 44, C.dark);
        fillRect(MARGIN, doc.y + 42, CONTENT_W, 2, C.red);

        doc.fontSize(18).font("Helvetica-Bold").fillColor(C.white)
          .text(stripMdInline(b.content), MARGIN + 14, doc.y + 12, { width: CONTENT_W - 28 });
        doc.y += 58;
        break;
      }

      case "h2": {
        checkPageBreak(50);
        doc.y += 10;
        fillRect(MARGIN, doc.y, CONTENT_W, 32, C.redLight);
        fillRect(MARGIN, doc.y, 4, 32, C.red);
        doc.fontSize(13).font("Helvetica-Bold").fillColor(C.redDark)
          .text(stripMdInline(b.content), MARGIN + 14, doc.y + 8, { width: CONTENT_W - 28 });
        doc.y += 44;
        break;
      }

      case "h3": {
        checkPageBreak(35);
        doc.y += 8;
        doc.fontSize(11).font("Helvetica-Bold").fillColor(C.text)
          .text(stripMdInline(b.content), MARGIN, doc.y, { width: CONTENT_W });
        doc.y += 4;
        hRule(doc.y, C.red, 60);
        doc.y += 10;
        break;
      }

      case "h4": {
        checkPageBreak(25);
        doc.y += 5;
        doc.fontSize(10).font("Helvetica-Bold").fillColor(C.red)
          .text(stripMdInline(b.content).toUpperCase(), MARGIN, doc.y, { width: CONTENT_W });
        doc.y += 8;
        break;
      }

      case "p": {
        const txt = stripMdInline(b.content);
        if (!txt.trim()) break;
        checkPageBreak(18);
        doc.fontSize(9).font("Helvetica").fillColor(C.text)
          .text(txt, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
        doc.y += 6;
        break;
      }

      case "li": {
        const txt = stripMdInline(b.content);
        checkPageBreak(16);
        // Bullet rouge
        doc.save().circle(MARGIN + 5, doc.y + 5, 2.5).fill(C.red).restore();
        doc.fontSize(9).font("Helvetica").fillColor(C.text)
          .text(txt, MARGIN + 14, doc.y, { width: CONTENT_W - 14, lineGap: 2 });
        doc.y += 5;
        break;
      }

      case "code": {
        const codeText = b.content;
        const lines = codeText.split("\n");
        const blockH = lines.length * 11 + 16;
        checkPageBreak(blockH + 10);

        doc.y += 4;
        fillRect(MARGIN, doc.y, CONTENT_W, blockH, "#F3F4F6");
        doc.save().rect(MARGIN, doc.y, CONTENT_W, blockH).stroke(C.borderGray).restore();
        fillRect(MARGIN, doc.y, 3, blockH, C.red);

        doc.fontSize(7.5).font("Courier").fillColor("#374151");
        let cy = doc.y + 8;
        lines.forEach((line) => {
          if (cy + 11 > BODY_BOTTOM) {
            newPage();
            drawHeader(currentSection);
            cy = BODY_TOP;
            fillRect(MARGIN, cy, CONTENT_W, 11 * (lines.length - lines.indexOf(line)) + 16, "#F3F4F6");
          }
          doc.text(line, MARGIN + 10, cy, { width: CONTENT_W - 20, lineBreak: false });
          cy += 11;
        });
        doc.y = cy + 8;
        break;
      }

      case "table": {
        if (!b.rows || b.rows.length === 0) break;

        const header = b.rows[0];
        const dataRows = b.rows.slice(1);
        const colCount = header.length;
        const colW = CONTENT_W / colCount;
        const rowH = 22;
        const tableH = (b.rows.length) * rowH + 4;

        checkPageBreak(tableH);
        doc.y += 6;

        let ty = doc.y;

        // Header row
        fillRect(MARGIN, ty, CONTENT_W, rowH, C.dark);
        header.forEach((cell, ci) => {
          doc.fontSize(8).font("Helvetica-Bold").fillColor(C.white)
            .text(cell, MARGIN + ci * colW + 6, ty + 6, { width: colW - 12, lineBreak: false });
        });
        ty += rowH;

        // Data rows
        dataRows.forEach((row, ri) => {
          const bg = ri % 2 === 0 ? C.white : C.lightGray;
          fillRect(MARGIN, ty, CONTENT_W, rowH, bg);

          // Border
          doc.save().rect(MARGIN, ty, CONTENT_W, rowH).stroke(C.borderGray).restore();

          row.forEach((cell, ci) => {
            const txt = stripMdInline(cell);
            // Highlight premier col en gras
            const font = ci === 0 ? "Helvetica-Bold" : "Helvetica";
            const color = ci === 0 ? C.text : C.textLight;
            doc.fontSize(8).font(font).fillColor(color)
              .text(txt, MARGIN + ci * colW + 6, ty + 6, { width: colW - 12, lineBreak: false });
          });
          ty += rowH;
        });

        // Border globale
        doc.save().rect(MARGIN, doc.y, CONTENT_W, ty - doc.y).stroke(C.midGray).restore();

        doc.y = ty + 10;
        break;
      }

      case "hr": {
        doc.y += 8;
        hRule(doc.y, C.borderGray);
        doc.y += 12;
        break;
      }
    }

    lastType = b.type;
  }
}

// ─── Génération principale ───────────────────────────────────────────────────

console.log("📄 Génération du PDF...");

// 1. Page de couverture
drawCover();

// 2. Contenu AUDIT.md
const mdText = fs.readFileSync(AUDIT_MD, "utf8");
// Sauter le titre principal (premier H1 = déjà en couverture)
const mdWithoutTitle = mdText.replace(/^#\s.+\n.+\n.+\n.+\n.+\n.+\n/, "");
const blocks = parseMd(mdWithoutTitle);

newPage();
drawHeader("Table des matières & Contenu");
doc.y = 55;

renderBlocks(blocks);

// 3. Ajouter numéros de page + en-têtes/pieds sur toutes les pages (sauf couverture)
const totalPages = doc.bufferedPageRange().count;
for (let i = 1; i < totalPages; i++) {
  doc.switchToPage(i);
  drawFooter(i + 1);
}

doc.end();

doc.on("end", () => {
  const size = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  console.log(`✅ PDF généré : ${OUTPUT}`);
  console.log(`   Taille : ${size} KB — ${totalPages} pages`);
});
