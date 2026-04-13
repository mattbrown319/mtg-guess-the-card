import type { NormalizedCard, StructuredQuery, ComparisonOperator } from "./types";
import type { TruthValue } from "./truth";
import { truthAnd, truthOr, truthNot } from "./truth";
import { resolveAtomicQuery } from "./resolvers";

export function evaluate(
  query: StructuredQuery,
  card: NormalizedCard
): TruthValue | null {
  switch (query.kind) {
    case "and": {
      let result: TruthValue = "yes";
      for (const clause of query.clauses) {
        const val = evaluate(clause, card);
        if (val === null) return null; // unsupported propagates
        result = truthAnd(result, val);
      }
      return result;
    }

    case "or": {
      let result: TruthValue = "no";
      for (const clause of query.clauses) {
        const val = evaluate(clause, card);
        if (val === null) return null;
        result = truthOr(result, val);
      }
      return result;
    }

    case "not": {
      const val = evaluate(query.clause, card);
      if (val === null) return null;
      return truthNot(val);
    }

    case "unsupported":
    case "subjective":
    case "unreliable":
    case "ambiguous":
      return null;

    default:
      // Atomic query — delegate to resolvers
      return resolveAtomicQuery(query, card);
  }
}

// Helper for comparison operators
export function compareValues(
  actual: number,
  operator: ComparisonOperator,
  target: number
): boolean {
  switch (operator) {
    case "=": return actual === target;
    case "<": return actual < target;
    case "<=": return actual <= target;
    case ">": return actual > target;
    case ">=": return actual >= target;
    default: return false;
  }
}
