/**
 * StudyLoop Share Card Generator
 * Renders a 1080x1920 (story-friendly) PNG of the session result using native Canvas.
 * Returns a Blob (PNG). No external dependencies.
 */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text || "").split(" ");
  let line = "";
  let cy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, cy);
      line = words[i] + " ";
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, cy);
  return cy + lineHeight;
}

/**
 * @param {Object} opts
 * @param {string} opts.title - "Quiz concluído" | "Flashcards revisados"
 * @param {string} opts.materia - subject name
 * @param {number} opts.acertos
 * @param {number} opts.total
 * @param {number} opts.streak
 * @param {string} opts.tipo - "quiz" | "flashcard"
 * @param {string} opts.username
 * @returns {Promise<Blob>}
 */
export async function buildShareCard({ title, materia, acertos, total, streak = 0, tipo = "quiz", username = "" }) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0B0D14");
  bg.addColorStop(1, "#12141D");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Amber radial glow top-right
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.18, 0, W * 0.85, H * 0.18, 700);
  glow.addColorStop(0, "rgba(245, 166, 35, 0.35)");
  glow.addColorStop(1, "rgba(245, 166, 35, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Subtle blue glow bottom-left for flashcards
  if (tipo === "flashcard") {
    const glow2 = ctx.createRadialGradient(W * 0.15, H * 0.82, 0, W * 0.15, H * 0.82, 700);
    glow2.addColorStop(0, "rgba(96, 165, 250, 0.28)");
    glow2.addColorStop(1, "rgba(96, 165, 250, 0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);
  }

  // Subtle dot grid texture
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let x = 60; x < W; x += 56) {
    for (let y = 60; y < H; y += 56) {
      ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Brand row (top)
  const brandY = 130;
  // amber logo square
  const logoX = 90, logoSize = 90;
  const logoGrad = ctx.createLinearGradient(logoX, brandY - logoSize / 2, logoX + logoSize, brandY + logoSize / 2);
  logoGrad.addColorStop(0, "#F5A623");
  logoGrad.addColorStop(1, "#FF7B00");
  ctx.fillStyle = logoGrad;
  roundRect(ctx, logoX, brandY - logoSize / 2, logoSize, logoSize, 22);
  ctx.fill();
  // Logo glyph (brain-ish: stylized "S")
  ctx.fillStyle = "#090A0F";
  ctx.font = "800 56px Outfit, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("S", logoX + 28, brandY + 2);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "700 46px Outfit, system-ui, sans-serif";
  ctx.fillText("StudyLoop", logoX + logoSize + 28, brandY);

  // Tag pill
  ctx.font = "600 26px DM Sans, system-ui, sans-serif";
  const pillTxt = tipo === "flashcard" ? "FLASHCARDS" : "QUIZ";
  const pillW = ctx.measureText(pillTxt).width + 44;
  const pillX = W - 90 - pillW;
  ctx.fillStyle = "rgba(245, 166, 35, 0.18)";
  roundRect(ctx, pillX, brandY - 24, pillW, 48, 24);
  ctx.fill();
  ctx.fillStyle = "#F5A623";
  ctx.fillText(pillTxt, pillX + 22, brandY);

  // Title
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "800 86px Outfit, system-ui, sans-serif";
  ctx.textBaseline = "top";
  let cursor = 360;
  cursor = wrapText(ctx, title, 90, cursor, W - 180, 100);

  // Materia name (accent)
  ctx.fillStyle = "#F5A623";
  ctx.font = "600 42px DM Sans, system-ui, sans-serif";
  ctx.fillText((materia || "").slice(0, 60), 90, cursor + 20);

  // Score circle
  const cx = W / 2, cy = 1080, r = 280;
  // ring background
  ctx.beginPath();
  ctx.lineWidth = 36;
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // ring fill (progress)
  const pct = total > 0 ? acertos / total : 0;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * (tipo === "flashcard" ? 1 : pct);
  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  if (tipo === "flashcard") {
    ringGrad.addColorStop(0, "#60A5FA"); ringGrad.addColorStop(1, "#A78BFA");
  } else {
    ringGrad.addColorStop(0, "#F5A623"); ringGrad.addColorStop(1, "#FF7B00");
  }
  ctx.beginPath();
  ctx.lineWidth = 36;
  ctx.lineCap = "round";
  ctx.strokeStyle = ringGrad;
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.stroke();

  // Score number in middle
  ctx.fillStyle = "#F8FAFC";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (tipo === "flashcard") {
    ctx.font = "800 220px Outfit, system-ui, sans-serif";
    ctx.fillText(String(total), cx, cy - 30);
    ctx.font = "500 44px DM Sans, system-ui, sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("cards revisados", cx, cy + 110);
  } else {
    ctx.font = "800 240px Outfit, system-ui, sans-serif";
    ctx.fillText(`${Math.round(pct * 100)}%`, cx, cy - 20);
    ctx.font = "500 44px DM Sans, system-ui, sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText(`${acertos} de ${total} acertos`, cx, cy + 130);
  }
  ctx.textAlign = "left";

  // Bottom stat strip
  const stripY = 1490;
  const stripH = 180;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  roundRect(ctx, 90, stripY, W - 180, stripH, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Streak flame
  const flameX = 160, flameCY = stripY + stripH / 2;
  // simple flame shape
  ctx.fillStyle = "#F5A623";
  ctx.beginPath();
  ctx.moveTo(flameX, flameCY + 38);
  ctx.bezierCurveTo(flameX - 36, flameCY + 14, flameX - 22, flameCY - 24, flameX, flameCY - 48);
  ctx.bezierCurveTo(flameX + 8, flameCY - 22, flameX + 28, flameCY - 30, flameX + 22, flameCY - 6);
  ctx.bezierCurveTo(flameX + 42, flameCY - 4, flameX + 40, flameCY + 26, flameX + 8, flameCY + 38);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "800 64px Outfit, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`${streak} dias`, flameX + 60, flameCY - 12);
  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 28px DM Sans, system-ui, sans-serif";
  ctx.fillText("de sequência ativa", flameX + 60, flameCY + 36);

  // Username right side
  if (username) {
    ctx.fillStyle = "#F8FAFC";
    ctx.font = "700 38px Outfit, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("@" + username.split(" ")[0].toLowerCase(), W - 130, flameCY);
    ctx.textAlign = "left";
  }

  // Footer CTA
  ctx.fillStyle = "#64748B";
  ctx.font = "500 32px DM Sans, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("studyloop.app — aprendizado ativo com IA", W / 2, 1780);
  ctx.textAlign = "left";

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
  });
}

/**
 * Try Web Share API with file. Fallback to download.
 */
export async function shareOrDownload(blob, filename, shareData = {}) {
  const file = new File([blob], filename, { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], ...shareData });
      return { method: "share" };
    }
  } catch (e) {
    // user cancelled or denied — fall through to download
  }
  // fallback download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { method: "download" };
}
