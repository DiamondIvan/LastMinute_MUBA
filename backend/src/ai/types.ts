/** A single source the research agent pulled in. */
export interface Source {
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  snippet: string;
  /** 0..1, set by the credibility agent. */
  credibility?: number;
}

/** Output of the research agent: a written briefing plus the sources behind it. */
export interface ResearchResult {
  findings: string;
  sources: Source[];
}

/** Output of the analysis pass for one topic. */
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
