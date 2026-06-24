export interface RagSource {
  id: string;
  text: string;
  score?: string;
}

export interface RagResponse {
  success: boolean;
  message: string;
  sources: RagSource[];
}
