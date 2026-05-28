export interface ResourceDeclaration {
  readonly path: string;
  readonly usage: string | readonly string[];
  readonly strategy?: "inline" | "archive" | "reject";
}

export interface ResourceCollectResult {
  readonly path: string;
  readonly sourcePath: string;
  readonly strategy: "inline" | "archive" | "reject";
  readonly mediaType?: string;
  readonly encoding?: string;
  readonly size: number;
  readonly sha256: string;
  readonly usage: readonly string[];
  readonly rejectReason?: string;
}
