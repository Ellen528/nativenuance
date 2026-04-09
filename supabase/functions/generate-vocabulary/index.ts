// Supabase Edge Function: Generate Vocabulary from Terms
// Takes a list of phrasal verbs/terms and generates definitions + examples

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
    const { terms, category } = await req.json();

    if (!terms || !Array.isArray(terms) || terms.length === 0) {
      return new Response(
        JSON.stringify({ error: "Terms array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const termType = category === 'phrasal_verbs' ? 'phrasal verb' : 'vocabulary term';
    const termsFormatted = terms.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n');

    const prompt = `Generate vocabulary entries for these ${termType}s:

${termsFormatted}

For EACH term, provide:
1. A clear, simple definition (10-20 words)
2. THREE natural example sentences showing the term in DIFFERENT contexts:
   - Example 1 (label: "Casual"): How friends or family would use it in conversation
   - Example 2 (label: "Workplace"): How colleagues would use it in a professional setting
   - Example 3 (label: "General"): A third distinct real-world scenario

OUTPUT FORMAT (JSON array):
[
  {
    "term": "pack into",
    "definition": "to fit many people or things into a small space",
    "examples": [
      { "label": "Casual", "sentence": "We all packed into my tiny apartment for the game night." },
      { "label": "Workplace", "sentence": "The team packed into the small meeting room for the urgent briefing." },
      { "label": "General", "sentence": "Hundreds of fans packed into the stadium to watch the final match." }
    ]
  }
]

RULES:
- Keep definitions simple and clear
- Each example sentence must show the term used naturally in a clearly different context
- For phrasal verbs, show the term conjugated naturally in each example

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
          temperature: 0.7,
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
    let rawItems: Array<{term: string; definition: string; examples: Array<{label: string; sentence: string}>}>;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      rawItems = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error("Failed to parse vocabulary from AI response");
    }

    // Convert to VocabularyItem format
    const vocabulary = rawItems.map((item) => ({
      term: item.term,
      definition: item.definition,
      category: category || "phrasal_verbs",
      source_context: item.examples?.[0]?.sentence,
      difficulty_level: "intermediate",
      examples: Array.isArray(item.examples)
        ? item.examples.map((ex) => ({
            sentence: ex.sentence,
            context_label: ex.label || "Example",
            explanation: "",
          }))
        : [],
    }));

    console.log(`Generated ${vocabulary.length} vocabulary items`);

    return new Response(JSON.stringify({ vocabulary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating vocabulary:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate vocabulary" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
