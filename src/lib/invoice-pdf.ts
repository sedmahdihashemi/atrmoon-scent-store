// Turn a styled invoice DOM node into a PDF, entirely in the browser (no server
// round-trip, works offline). The node is rasterized with html2canvas, then
// placed into an A4 jsPDF page; a tall invoice paginates onto extra pages.
//
// The PDF libraries are imported lazily (dynamic import) so they never load
// during server-side rendering and stay out of the main bundle until needed.
//
// NOTE: the invoice node must use plain hex/rgb colors inline (no oklch / Tailwind
// color utilities) — html2canvas 1.4 cannot parse modern CSS color functions.
async function renderCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  // html2canvas-pro understands modern CSS color functions (oklch/lab/color-mix)
  // that the whole app's theme uses — the classic html2canvas throws on them.
  const html2canvas = (await import("html2canvas-pro")).default;
  // Wait for web fonts so Persian text renders instead of a fallback.
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }
  const canvas = await html2canvas(node, {
    scale: Math.min(2, (window.devicePixelRatio || 1) + 1),
    backgroundColor: "#f4e8d0",
    useCORS: true,
    logging: false,
  });
  if (!canvas || !canvas.width || !canvas.height) {
    throw new Error("تصویر فاکتور خالی شد");
  }
  return canvas;
}

export async function renderInvoicePdf(node: HTMLElement): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const canvas = await renderCanvas(node);
  const img = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ unit: "px", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (imgH <= pageH + 2) {
    pdf.addImage(img, "JPEG", 0, 0, imgW, imgH);
  } else {
    // One tall image sliced across pages by shifting it up each page.
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
  }
  return pdf.output("blob");
}

function isStandalone() {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export async function downloadInvoicePdf(node: HTMLElement, filename: string) {
  const blob = await renderInvoicePdf(node);
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & {
    canShare?: (data?: any) => boolean;
    share?: (data?: any) => Promise<void>;
  };
  // Inside an installed PWA, a programmatic <a download> is often blocked.
  // If the device can share a file, use the share sheet (the user can pick
  // "Save to Files"/"Download"); otherwise fall back to the link download.
  if (isStandalone() && nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      // fall through to link download
    }
  }
  saveBlob(blob, filename);
}

// Share the PDF through the device's native share sheet (WhatsApp, Bale,
// Telegram…). Falls back to a plain download where file-sharing isn't supported.
export async function shareInvoicePdf(
  node: HTMLElement,
  filename: string,
  title: string
): Promise<"shared" | "downloaded"> {
  const blob = await renderInvoicePdf(node);
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & {
    canShare?: (data?: any) => boolean;
    share?: (data?: any) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (e: any) {
      if (e?.name === "AbortError") return "shared"; // user closed the sheet
      // fall through to download
    }
  }
  saveBlob(blob, filename);
  return "downloaded";
}
