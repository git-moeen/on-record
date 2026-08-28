export type Stance = "expand" | "restrict" | "protect" | "fund" | "neutral";

export type TopicId = "housing" | "water" | "ai";

export type DatePrecision = "day" | "month" | "year";

export type PersonId =
  | "newsom"
  | "padilla"
  | "schiff"
  | "porter"
  | "lurie"
  | "bass";

export type Official = {
  id: PersonId;
  name: string;
  office: string;
  jurisdiction: string;
  aliases: string[];
  sources: OfficialSource[];
};

export type OfficialSource = {
  label: string;
  url: string;
  kind: "newsroom" | "press" | "site";
};

export type Statement = {
  id: string;
  personId: PersonId;
  date: string;
  datePrecision: DatePrecision;
  topics: TopicId[];
  stance: Stance;
  text: string;
  quote?: string;
  sourceUrl: string;
  sourceLabel: string;
  synthetic: boolean;
};

export type Citation = {
  statementId: string;
  personName: string;
  date: string;
  sourceUrl: string;
  sourceLabel: string;
  excerpt: string;
  synthetic: boolean;
};

export type Conflict = {
  topic: TopicId;
  personName: string;
  left: Citation;
  right: Citation;
  note: string;
};

export type AskAnswer = {
  question: string;
  answer: string;
  citations: Citation[];
  conflicts: Conflict[];
  unsure: boolean;
  mode: "fixture" | "infona";
  infonaNote?: string;
  matchedPeople: string[];
  matchedTopics: TopicId[];
  year?: number;
};

export type GraphPayload = {
  people: Array<{
    id: PersonId;
    name: string;
    office: string;
    statementCount: number;
  }>;
  topics: Array<{ id: TopicId; label: string; statementCount: number }>;
  statements: Array<{
    id: string;
    personId: PersonId;
    topics: TopicId[];
    date: string;
    stance: Stance;
    synthetic: boolean;
    label: string;
  }>;
  edges: Array<{ from: string; to: string; kind: "said" | "about" }>;
  mode: "fixture" | "infona";
};

export type StatusPayload = {
  mode: "fixture" | "infona";
  infonaUrl: string | null;
  infonaReachable: boolean;
  statementCount: number;
  officialCount: number;
  lastEnrichedAt: string | null;
};
