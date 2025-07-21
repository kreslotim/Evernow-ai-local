import { AnalyzeType } from '@prisma/client';

export const isCoupleAnalyze = (type: AnalyzeType): boolean => {
  return (
    type === ('COUPLE_COMPATIBILITY_ANALYZE' as AnalyzeType) ||
    type === ('BUSINESS_COMPATIBILITY_ANALYZE' as AnalyzeType)
  );
};
