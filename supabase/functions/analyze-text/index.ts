// Supabase Edge Function: Analyze Text for Vocabulary Extraction
// Extracts practical English vocabulary (phrasal verbs, idioms, collocations)
// focused on daily life and professional contexts.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, sourceType, proficiency, comprehensive, bookContext } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bookContextNote = bookContext
      ? `\nBOOK CONTEXT: This text is from "${bookContext.bookTitle}", chapter "${bookContext.chapterTitle}". The book teaches: ${bookContext.bookSubject || "general English"}. Extract vocabulary relevant to this subject.`
      : "";

    const comprehensiveNote = comprehensive
      ? "\nMODE: Comprehensive — extract ALL notable vocabulary, not just the most advanced terms."
      : "\nMODE: Selective — focus only on the most useful and non-obvious terms an intermediate learner would benefit from.";

    const proficiencyNote = proficiency
      ? `\nLEARNER LEVEL: ${proficiency}. Calibrate vocabulary difficulty accordingly.`
      : "";

    const prompt = `You are an English vocabulary extraction expert for advanced language learners. Extract vocabulary that is genuinely useful for daily life and professional work.
${bookContextNote}${comprehensiveNote}${proficiencyNote}

SOURCE TYPE: ${sourceType || "article"}

EXTRACT these vocabulary types:
- Phrasal verbs (e.g., "pull off", "figure out", "come across as")
- Fixed idioms and expressions (e.g., "bite the bullet", "sit on the fence")
- Nuanced collocations with non-obvious meaning (e.g., "raise an eyebrow", "land on your feet")
- Common chunks and discourse markers (e.g., "at the end of the day", "it goes without saying")
- Topic-specific terms relevant to daily life or professional contexts

STRICT EXCLUSIONS — do NOT include:
- Wordplay, puns, portmanteau, or humor-based word combinations (e.g., "Adora-bull", "fan-tastic")
- Made-up words or neologisms that only appear in one niche context
- Proper nouns (person names, brand names, place names)
- Basic vocabulary any intermediate learner already knows (e.g., "happy", "big", "run")
- Terms that are only funny or meaningful as an in-joke in this specific text
- Near-duplicates or variations of the same term — pick the BASE FORM only

DEDUPLICATION:
- Each term must appear EXACTLY ONCE in the output
- Prefer the base/infinitive form: "pull off" not "pulled off", "come across" not "comes across"
- If multiple surface forms exist, keep the most versatile base form

CATEGORIES (assign exactly one per term):
- "phrasal_verbs": Verb + particle combinations
- "idioms_fixed": Fixed idiomatic expressions with figurative meaning
- "nuance_sarcasm": Words/phrases with subtle tone, irony, or nuanced register
- "chunks_structures": Collocations, discourse markers, sentence frames
- "topic_specific": Domain-specific vocabulary useful in a recognizable real-world context

EXAMPLES requirement: Provide EXACTLY 2 example sentences per term in DIFFERENT contexts:
1. Casual/spoken context (friends, family, daily life)
2. Workplace or formal context (professional, news, academic)

LIMIT: Extract a MAXIMUM of 15 vocabulary items. Prioritize the most useful and non-obvious terms.

OUTPUT FORMAT (return only valid JSON, no markdown):
{
  "summary": "1-2 sentence summary of the text's main topic",
  "tone": "one phrase describing the tone",
  "vocabulary": [
    {
      "term": "pull off",
      "definition": "to succeed in doing something difficult",
      "category": "phrasal_verbs",
      "examples": [
        {
          "context_label": "Casual",
          "sentence": "She pulled off an amazing party with only two hours of prep."
        },
        {
          "context_label": "Workplace",
          "sentence": "The team pulled off the launch despite a tight deadline."
        }
      ]
    }
  ]
}

TEXT TO ANALYZE:
${text.substring(0, 50000)}

Return ONLY valid JSON. No markdown, no code blocks, no extra commentary.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 32768,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No content in Gemini response");
    }

    let result: { summary: string; tone: string; vocabulary: any[] };
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error("Failed to parse analysis from AI response");
    }

    // Deduplicate by term (case-insensitive) as a safety net
    const seen = new Set<string>();
    const deduped = (result.vocabulary || []).filter((item: any) => {
      const key = item.term?.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Normalize to VocabularyItem format
    const vocabulary = deduped.map((item: any) => ({
      term: item.term,
      definition: item.definition,
      category: item.category || "chunks_structures",
      imagery_etymology: item.imagery_etymology || undefined,
      source_context: item.examples?.[0]?.sentence || undefined,
      difficulty_level: "intermediate",
      examples: Array.isArray(item.examples)
        ? item.examples.map((ex: any) => ({
            context_label: ex.context_label || "Example",
            sentence: ex.sentence,
            explanation: ex.explanation || "",
          }))
        : [],
    }));

    console.log(`Analyzed text: ${vocabulary.length} vocabulary items extracted`);

    return new Response(
      JSON.stringify({
        summary: result.summary || "",
        tone: result.tone || "",
        vocabulary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error analyzing text:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to analyze text" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
