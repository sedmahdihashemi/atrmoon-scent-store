import { forwardRef } from "react";
import logoMark from "@/assets/logo-mark.png";
import {
  type InvoiceItem,
  type InvoiceSettings,
  lineTotal,
  computeTotals,
  formatToman,
  toFa,
  faDate,
} from "@/lib/invoice";

// Vintage/nostalgic sales invoice, rendered as a self-contained "paper" that
// html2canvas can rasterize into a PDF. Everything here uses plain hex colors
// inline — NO Tailwind color utilities, NO oklch — so html2canvas 1.4 can parse
// every computed color in the subtree.

// explicit palette (kept simple and literal on purpose)
const INK = "#2f261c";
const INK_SOFT = "#5c4e3d";
const PAPER = "#f4e8d0";
const PAPER_ALT = "#efe3c9";
const GOLD = "#b08a46";
const GOLD_DEEP = "#8a6a31";
const BORDER = "#cbb27e";

export type InvoicePaperProps = {
  settings: InvoiceSettings;
  storeName: string;
  invoiceNo: string;
  issuedAt?: string;
  customerName?: string;
  customerPhone?: string;
  customerNote?: string;
  items: InvoiceItem[];
  discount: number;
  shipping: number;
};

export const InvoicePaper = forwardRef<HTMLDivElement, InvoicePaperProps>(function InvoicePaper(
  { settings, storeName, invoiceNo, issuedAt, customerName, customerPhone, customerNote, items, discount, shipping },
  ref
) {
  const { subtotal, total } = computeTotals(items, discount, shipping);
  const name = settings.header_name?.trim() || storeName;
  const showStamp = settings.show_stamp !== false;

  const serif = "'Gentium Plus', 'Vazirmatn', serif";
  const sans = "'Vazirmatn', sans-serif";

  const th: React.CSSProperties = {
    padding: "9px 10px",
    fontFamily: sans,
    fontSize: 13,
    fontWeight: 700,
    color: PAPER,
    textAlign: "center",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "9px 10px",
    fontFamily: sans,
    fontSize: 13,
    color: INK,
    textAlign: "center",
    borderBottom: `1px solid ${BORDER}`,
  };

  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        width: 720,
        boxSizing: "border-box",
        background: PAPER,
        color: INK,
        fontFamily: sans,
        padding: 28,
        position: "relative",
      }}
    >
      {/* Double decorative frame */}
      <div
        style={{
          border: `2px solid ${GOLD_DEEP}`,
          boxShadow: `inset 0 0 0 4px ${PAPER}, inset 0 0 0 5px ${BORDER}`,
          padding: 26,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Header: identity (right) + meta (left) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
            <img src={logoMark} width={54} height={54} alt="" style={{ width: 54, height: 54, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: serif, fontSize: 24, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{name}</div>
              {settings.phone ? (
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 3 }}>تلفن: {toFa(settings.phone)}</div>
              ) : null}
              {settings.address ? (
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2, maxWidth: 320 }}>{settings.address}</div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: "8px 14px",
              background: PAPER_ALT,
              flexShrink: 0,
            }}
          >
            <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: GOLD_DEEP }}>فاکتور فروش</div>
            <div style={{ fontSize: 12, color: INK, marginTop: 5 }}>شماره: {toFa(invoiceNo)}</div>
            <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>تاریخ: {faDate(issuedAt || new Date())}</div>
          </div>
        </div>

        {/* Ornamental divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0" }}>
          <div style={{ height: 1, background: BORDER, flex: 1 }} />
          <div style={{ color: GOLD, fontSize: 14 }}>❖</div>
          <div style={{ height: 1, background: BORDER, flex: 1 }} />
        </div>

        {/* Customer */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 24px", marginBottom: 14, fontSize: 13 }}>
          <div style={{ color: INK }}>
            <span style={{ color: INK_SOFT }}>مشتری: </span>
            {customerName?.trim() || "—"}
          </div>
          {customerPhone?.trim() ? (
            <div style={{ color: INK }}>
              <span style={{ color: INK_SOFT }}>تلفن: </span>
              {toFa(customerPhone)}
            </div>
          ) : null}
        </div>

        {/* Items */}
        <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${GOLD_DEEP}` }}>
          <thead>
            <tr style={{ background: INK }}>
              <th style={{ ...th, width: 42 }}>#</th>
              <th style={{ ...th, textAlign: "right" }}>شرح کالا</th>
              <th style={{ ...th, width: 64 }}>تعداد</th>
              <th style={{ ...th, width: 130 }}>قیمت واحد</th>
              <th style={{ ...th, width: 140 }}>مبلغ (تومان)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td style={{ ...td, textAlign: "center" }} colSpan={5}>
                  —
                </td>
              </tr>
            ) : (
              items.map((it, i) => (
                <tr key={i} style={{ background: i % 2 ? PAPER_ALT : PAPER }}>
                  <td style={td}>{toFa(i + 1)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ color: INK }}>{it.title || "—"}</div>
                    {it.note?.trim() ? (
                      <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 2 }}>{it.note}</div>
                    ) : null}
                  </td>
                  <td style={td}>{toFa(it.qty)}</td>
                  <td style={td}>{formatToman(it.unit_price)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{formatToman(lineTotal(it))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals + stamp */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginTop: 16 }}>
          {/* Stamp area (start side) */}
          <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
            {showStamp ? <Stamp logoSrc={logoMark} /> : null}
          </div>

          {/* Totals (end side) */}
          <div style={{ width: 300, maxWidth: "60%" }}>
            <Row label="جمع جزء" value={`${formatToman(subtotal)} تومان`} />
            {discount > 0 ? <Row label="تخفیف" value={`− ${formatToman(discount)} تومان`} /> : null}
            {shipping > 0 ? <Row label="هزینه ارسال" value={`+ ${formatToman(shipping)} تومان`} /> : null}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 8,
                padding: "10px 12px",
                background: INK,
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 14, color: PAPER, fontWeight: 700 }}>مبلغ قابل پرداخت</span>
              <span style={{ fontSize: 16, color: "#e9c984", fontFamily: serif, fontWeight: 700 }}>
                {formatToman(total)} تومان
              </span>
            </div>
          </div>
        </div>

        {/* Notes / footer */}
        {customerNote?.trim() ? (
          <div style={{ marginTop: 16, fontSize: 12, color: INK_SOFT, lineHeight: 1.9 }}>
            <span style={{ color: GOLD_DEEP, fontWeight: 700 }}>توضیحات: </span>
            {customerNote}
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 10px" }}>
          <div style={{ height: 1, background: BORDER, flex: 1 }} />
          <div style={{ color: GOLD, fontSize: 12 }}>✦</div>
          <div style={{ height: 1, background: BORDER, flex: 1 }} />
        </div>

        <div style={{ fontSize: 12, color: INK_SOFT, textAlign: "center", lineHeight: 1.9 }}>
          {settings.footer_note?.trim() || "از خرید شما سپاسگزاریم. سلامتی و خوشبختی همراهتان باد."}
        </div>

        <div style={{ textAlign: "center", marginTop: 12, fontSize: 10, color: GOLD_DEEP }}>
          ساخته‌شده با عطرمون — atrmoon.top
        </div>
      </div>
    </div>
  );
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 2px", fontSize: 13 }}>
      <span style={{ color: "#5c4e3d" }}>{label}</span>
      <span style={{ color: "#2f261c" }}>{value}</span>
    </div>
  );
}

// A faux ink stamp: double ring + logo + curved-ish text, tinted gold, rotated.
function Stamp({ logoSrc }: { logoSrc: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: "rotate(-11deg)",
        opacity: 0.9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 128,
          height: 128,
          borderRadius: "50%",
          border: "3px double #9a7536",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#9a7536",
          boxShadow: "inset 0 0 0 1px #c7a765",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700 }}>عطرمون</div>
        <img src={logoSrc} width={44} height={44} alt="" style={{ width: 44, height: 44, margin: "3px 0", opacity: 0.85 }} />
        <div style={{ fontSize: 8, fontWeight: 700 }}>تضمین اصالت</div>
        <div style={{ fontSize: 7, letterSpacing: 2, marginTop: 1 }}>ATRMOON</div>
      </div>
    </div>
  );
}
