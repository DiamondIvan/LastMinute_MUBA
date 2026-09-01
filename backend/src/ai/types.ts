/** A single source the research agent pulled in. */
export interface Source {
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  snippet: string;
}

/** Output of the analysis + credibility passes for one topic. */
export interface Analysis {
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  confidence: number; // 0..1
  risk: 'low' | 'medium' | 'high';
  keyDevelopments: string[];
  risks: string[];
}

/** The full intelligence report. `full` is premium; `summary` is shown for free. */
export interface IntelligenceReport {
  question: string;
  title: string;
  summary: string;
  full: string;
  analysis: Analysis;
  sources: Source[];
  generatedAt: string;
}
