// Generic fallback thresholds for crop monitoring
// These are used ONLY when a seller has not explicitly configured optimum thresholds for their crop allocation.

export const GENERIC_CROP_THRESHOLDS = {
  moisture: {
    min: 30, // 30%
    max: 60  // 60%
  },
  temperature: {
    min: 15, // 15°C
    max: 35  // 35°C
  }
};
