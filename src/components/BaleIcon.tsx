import baleLogo from "@/assets/bale-logo.svg";

// The source SVG's own coordinate box is 601x841 — always force an explicit
// pixel box here (attribute + inline style) so it can never blow up past
// its container regardless of where it's dropped in.
export function BaleIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={baleLogo}
      alt="بله"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
