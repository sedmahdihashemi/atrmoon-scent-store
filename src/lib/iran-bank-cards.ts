// Well-known Iranian bank card IIN/BIN prefixes (first 6 digits).
// Informational only — used to show the bank name/logo as a convenience
// while entering/viewing a card number. An unrecognized prefix is not an
// error; it just means we don't show anything.
//
// iconKey matches a named export in @snapp-store/iranian-banks-react-icons
// (that package's own name, e.g. "Melli" -> MelliColorIcon) — see
// src/lib/bank-icons.tsx for the actual component lookup.
export type BankInfo = { name: string; iconKey: string };

const BIN_TO_BANK: Record<string, BankInfo> = {
  "603799": { name: "بانک ملی ایران", iconKey: "Melli" },
  "610433": { name: "بانک ملت", iconKey: "Mellat" },
  "589210": { name: "بانک سپه", iconKey: "Sepah" },
  "627961": { name: "بانک صنعت و معدن", iconKey: "SanatMadan" },
  "603770": { name: "بانک کشاورزی", iconKey: "Keshavarzi" },
  "628023": { name: "بانک مسکن", iconKey: "Maskan" },
  "627760": { name: "پست بانک ایران", iconKey: "Post" },
  "502908": { name: "بانک توسعه تعاون", iconKey: "ToseeTaavon" },
  "627648": { name: "بانک توسعه صادرات", iconKey: "ToseeSaderat" },
  "627412": { name: "بانک اقتصاد نوین", iconKey: "EghtesadNovin" },
  "606256": { name: "بانک اقتصاد نوین", iconKey: "EghtesadNovin" },
  "622106": { name: "بانک پارسیان", iconKey: "Parsian" },
  "639194": { name: "بانک پارسیان", iconKey: "Parsian" },
  "502229": { name: "بانک پاسارگاد", iconKey: "Pasargad" },
  "639347": { name: "بانک پاسارگاد", iconKey: "Pasargad" },
  "627488": { name: "بانک کارآفرین", iconKey: "Karafarin" },
  "621986": { name: "بانک سامان", iconKey: "Saman" },
  "639346": { name: "بانک سینا", iconKey: "Sina" },
  "639607": { name: "بانک سرمایه", iconKey: "Sarmayeh" },
  "636214": { name: "بانک آینده", iconKey: "Ayandeh" },
  "502806": { name: "بانک شهر", iconKey: "Shahr" },
  "504172": { name: "بانک شهر", iconKey: "Shahr" },
  "502938": { name: "بانک دی", iconKey: "Dey" },
  "505785": { name: "بانک ایران زمین", iconKey: "IranZamin" },
  "636795": { name: "بانک مهر ایران", iconKey: "MehrIran" },
  "585983": { name: "بانک تجارت", iconKey: "Tejarat" },
  "585947": { name: "بانک تجارت", iconKey: "Tejarat" },
  "621663": { name: "بانک تجارت", iconKey: "Tejarat" },
  "589463": { name: "بانک رفاه کارگران", iconKey: "Refah" },
  "505416": { name: "بانک گردشگری", iconKey: "Gardeshgari" },
  "639370": { name: "بانک مهر اقتصاد (ادغام‌شده در سپه)", iconKey: "SepahMergedMehrEghtesad" },
  "627381": { name: "بانک انصار (ادغام‌شده در سپه)", iconKey: "SepahMergedAnsar" },
  "636949": { name: "بانک حکمت ایرانیان (ادغام‌شده در سپه)", iconKey: "SepahMergedHekmat" },
  "606373": { name: "بانک قوامین (ادغام‌شده در سپه)", iconKey: "SepahMergedGhavamin" },
  "639599": { name: "بانک قوامین (ادغام‌شده در سپه)", iconKey: "SepahMergedGhavamin" },
};

export function detectIranianBank(cardNumber: string | null | undefined): BankInfo | null {
  const digits = (cardNumber ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  return BIN_TO_BANK[digits.slice(0, 6)] ?? null;
}
