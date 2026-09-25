import type { ComponentType, SVGProps } from "react";
import {
  MelliColorIcon,
  MellatColorIcon,
  SepahColorIcon,
  SanatMadanColorIcon,
  KeshavarziColorIcon,
  MaskanColorIcon,
  PostColorIcon,
  ToseeTaavonColorIcon,
  ToseeSaderatColorIcon,
  EghtesadNovinColorIcon,
  ParsianColorIcon,
  PasargadColorIcon,
  KarafarinColorIcon,
  SamanColorIcon,
  SinaColorIcon,
  SarmayehColorIcon,
  AyandehColorIcon,
  ShahrColorIcon,
  DeyColorIcon,
  IranZaminColorIcon,
  MehrIranColorIcon,
  TejaratColorIcon,
  RefahColorIcon,
  GardeshgariColorIcon,
  SepahMergedMehrEghtesadColorIcon,
  SepahMergedAnsarColorIcon,
  SepahMergedHekmatColorIcon,
  SepahMergedGhavaminColorIcon,
} from "@snapp-store/iranian-banks-react-icons";

// Only the icons actually referenced by src/lib/iran-bank-cards.ts's BIN
// table are imported here (not the package's full ~140 exports), so
// tree-shaking keeps the unused ones out of the bundle.
const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  Melli: MelliColorIcon,
  Mellat: MellatColorIcon,
  Sepah: SepahColorIcon,
  SanatMadan: SanatMadanColorIcon,
  Keshavarzi: KeshavarziColorIcon,
  Maskan: MaskanColorIcon,
  Post: PostColorIcon,
  ToseeTaavon: ToseeTaavonColorIcon,
  ToseeSaderat: ToseeSaderatColorIcon,
  EghtesadNovin: EghtesadNovinColorIcon,
  Parsian: ParsianColorIcon,
  Pasargad: PasargadColorIcon,
  Karafarin: KarafarinColorIcon,
  Saman: SamanColorIcon,
  Sina: SinaColorIcon,
  Sarmayeh: SarmayehColorIcon,
  Ayandeh: AyandehColorIcon,
  Shahr: ShahrColorIcon,
  Dey: DeyColorIcon,
  IranZamin: IranZaminColorIcon,
  MehrIran: MehrIranColorIcon,
  Tejarat: TejaratColorIcon,
  Refah: RefahColorIcon,
  Gardeshgari: GardeshgariColorIcon,
  SepahMergedMehrEghtesad: SepahMergedMehrEghtesadColorIcon,
  SepahMergedAnsar: SepahMergedAnsarColorIcon,
  SepahMergedHekmat: SepahMergedHekmatColorIcon,
  SepahMergedGhavamin: SepahMergedGhavaminColorIcon,
};

export function BankIcon({ iconKey, size = 28 }: { iconKey: string; size?: number }) {
  const Icon = ICONS[iconKey];
  if (!Icon) return null;
  return <Icon width={size} height={size} />;
}
