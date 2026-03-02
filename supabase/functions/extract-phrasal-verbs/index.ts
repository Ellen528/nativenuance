// Supabase Edge Function: Extract Phrasal Verbs from Book
// Specialized extraction for phrasal verb textbooks with the pattern:
// - Example sentence (phrasal verb highlighted)
// - Phrasal verb name
// - Simple definition

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, chapterTitle } = await req.json();

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

    const prompt = `Extract phrasal verbs from this English textbook chapter.

THE BOOK HAS THIS EXACT FORMAT FOR EACH PHRASAL VERB:
Line 1: Example sentence (the phrasal verb appears conjugated, e.g., "packed into", "fitted in")
Line 2: Base form of phrasal verb (e.g., "pack into", "fit in (with)")
Line 3: Simple definition in italics

EXAMPLE FROM BOOK:
"Hundreds of people packed into the town hall to watch the debate."
pack into
fit into a place in large numbers

WHAT TO EXTRACT:
- term: "pack into" (the BASE FORM on line 2, NOT "packed into" from the sentence)
- definition: "fit into a place in large numbers" (from line 3)
- example: "Hundreds of people packed into the town hall to watch the debate." (from line 1)

MORE EXAMPLES:
"I found it really hard to fit in with the art class."
fit in (with)
feel like you belong in a group

Extract as: { "term": "fit in (with)", "definition": "feel like you belong in a group", "example": "I found it really hard to fit in with the art class." }

OUTPUT FORMAT:
[
  {
    "term": "pack into",
    "definition": "fit into a place in large numbers",
    "example": "Hundreds of people packed into the town hall to watch the debate."
  }
]

CRITICAL RULES:
- term MUST be the BASE FORM (pack into, NOT packed into)
- Include parentheses if shown: "fit in (with)", "gang up (on)"
- definition is the SHORT explanation from the book
- example is the FULL sentence from the book
- Extract ALL phrasal verbs from the chapter

CHAPTER: ${chapterTitle}

TEXT:
${text.substring(0, 30000)}

Return ONLY valid JSON array, no markdown.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
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

    // Parse the JSON response
    let rawItems: Array<{term: string; definition: string; example: string}>;
    try {
      // Remove potential markdown code blocks
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      rawItems = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error("Failed to parse phrasal verbs from AI response");
    }

    // Convert to VocabularyItem format with examples
    const vocabulary = rawItems.map((item) => ({
      term: item.term,
      definition: item.definition,
      category: "phrasal_verbs" as const,
      source_context: item.example,
      difficulty_level: "intermediate",
      examples: [{
        sentence: item.example,
        context_label: "From textbook",
        explanation: ""
      }]
    }));

    console.log(`Extracted ${vocabulary.length} phrasal verbs from "${chapterTitle}"`);

    return new Response(JSON.stringify({ vocabulary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error extracting phrasal verbs:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to extract phrasal verbs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
