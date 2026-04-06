export type TruthValue = "yes" | "no" | "sometimes";

export function truthAnd(a: TruthValue, b: TruthValue): TruthValue {
  if (a === "no" || b === "no") return "no";
  if (a === "sometimes" || b === "sometimes") return "sometimes";
  return "yes";
}

export function truthOr(a: TruthValue, b: TruthValue): TruthValue {
  if (a === "yes" || b === "yes") return "yes";
  if (a === "sometimes" || b === "sometimes") return "sometimes";
  return "no";
}

export function truthNot(a: TruthValue): TruthValue {
  if (a === "yes") return "no";
  if (a === "no") return "yes";
  return "sometimes";
}
