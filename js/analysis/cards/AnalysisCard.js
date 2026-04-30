/**
 * AnalysisCard (Compatibility Shell)
 * Extends BaseAnalysisCard. Currently acts as a full pass-through.
 * Future: Phase-specific subclasses (FaceAnalysisCard, etc.) will be
 * used instead of this generic class.
 */
class AnalysisCard extends BaseAnalysisCard {
  // All logic is inherited from BaseAnalysisCard.
  // Phase-specific overrides will be added here as refactoring progresses.
}

window.AnalysisCard = AnalysisCard;
