export class BundleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BundleError";
  }
}

export const BundleErrorCodes = {
  FILE_NOT_FOUND: "BUNDLE-001",
  MANIFEST_MISSING: "BUNDLE-002",
  DOCUMENT_MISSING: "BUNDLE-003",
  UNSUPPORTED_VERSION: "BUNDLE-004",
  INVALID_KIND: "BUNDLE-005",
  DOCUMENT_HASH_MISMATCH: "BUNDLE-006",
  RESOURCE_HASH_MISMATCH: "BUNDLE-007",
  RESOURCE_PATH_INVALID: "BUNDLE-008",
  RESOURCE_EXCEEDS_LIMIT: "BUNDLE-009",
  RESOURCE_UNCLAIMED: "BUNDLE-010",
  DUPLICATE_RESOURCE_PATH: "BUNDLE-011",
  RESOURCE_DECODE_FAILED: "BUNDLE-012",
} as const;
