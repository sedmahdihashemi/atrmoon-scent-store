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
  // Inside an installed PWA a programmatic <a download> is often blocked and
  // there's no download-notification to open the file — so we open the PDF in
  // a new browser tab (a real viewer) instead. The tab MUST be opened now,
  // synchronously within the click, before any await, or it gets popup-blocked.
  const standalone = isStandalone();
  const viewer = standalone ? window.open("", "_blank") : null;

  let blob: Blob;
  try {
    blob = await renderInvoicePdf(node);
  } catch (e) {
    viewer?.close();
    throw e;
  }
  const url = URL.createObjectURL(blob);

  if (viewer) {
    try {
      viewer.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    } catch {
      /* fall through to a normal download */
    }
  }
  // Normal browser: a real file download (shows the system download notice).
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
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
