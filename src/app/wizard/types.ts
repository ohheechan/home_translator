import type { HousingProgram, MedianIncomeTable } from "../../types/program";
import type { GenericDocumentMetadata } from "../../parser/generic-metadata";
import type { DocumentTier } from "../../parser/classify";
import type { BaseProfile, ScoringDetail } from "../../types/profile";

export type Step =
  | "home"
  | "upload"
  | "tier-b"
  | "tier-c"
  | "area-select"
  | "profile1"
  | "profile2"
  | "profile3"
  | "score-detail"
  | "result";

export interface ParsedDocument {
  tier: DocumentTier;
  program: HousingProgram | null;
  medianIncomeTable: MedianIncomeTable | null;
  parseWarnings: string[];
  tierReasons: string[];
  genericMetadata: GenericDocumentMetadata | null;
}

export interface WizardState {
  step: Step;
  loading: boolean;
  errorMessage: string | null;
  doc: ParsedDocument | null;
  desiredAreaM2: number | undefined;
  desiredSupplyMethod: string | undefined;
  base: Partial<BaseProfile>;
  detail: Partial<ScoringDetail>;
}

export const initialWizardState: WizardState = {
  step: "home",
  loading: false,
  errorMessage: null,
  doc: null,
  desiredAreaM2: undefined,
  desiredSupplyMethod: undefined,
  base: {},
  detail: {},
};
