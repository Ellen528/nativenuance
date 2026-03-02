// Supabase Edge Function: Extract Book Structure
// Uses Gemini AI to analyze PDF text and extract hierarchical chapter structure

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

interface BookChapter {
  id: string;
  title: string;
  level: number;
  pageStart?: number;
  pageEnd?: number;
  children?: BookChapter[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, pageCount } = await req.json();

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

    const prompt = `You are analyzing a book to extract its hierarchical structure.

TASK: Extract the table of contents structure from this book.

CRITICAL STRUCTURE RULES:
1. The TOP LEVEL array should ONLY contain CATEGORY headers (sections without numbers like "DESCRIBING PEOPLE AND THINGS", "Daily routines", "Work and study")
2. NUMBERED UNITS (like "01 People and things", "1 Get up", "Unit 2: Family") must be CHILDREN of their category, NOT at the top level
3. DO NOT create a flat list - use proper parent-child nesting

CORRECT EXAMPLE:
Input TOC:
  "DESCRIBING PEOPLE AND THINGS"
  "01 People and things......18"
  "02 Family......22"
  "03 Relationships......26"
  "WORK AND STUDY"
  "04 Starting work......30"

Output structure:
{
  "structure": [
    {
      "title": "DESCRIBING PEOPLE AND THINGS",
      "level": 1,
      "children": [
        {"title": "01 People and things", "level": 2, "pageStart": 18, "children": []},
        {"title": "02 Family", "level": 2, "pageStart": 22, "children": []},
        {"title": "03 Relationships", "level": 2, "pageStart": 26, "children": []}
      ]
    },
    {
      "title": "WORK AND STUDY",
      "level": 1,
      "children": [
        {"title": "04 Starting work", "level": 2, "pageStart": 30, "children": []}
      ]
    }
  ]
}

WRONG (DO NOT DO THIS - flat list):
{
  "structure": [
    {"title": "DESCRIBING PEOPLE AND THINGS", "level": 1, "children": []},
    {"title": "01 People and things", "level": 2, "children": []},
    {"title": "02 Family", "level": 2, "children": []}
  ]
}

ADDITIONAL RULES:
1. Identify the book's title and author
2. Identify the book's SUBJECT (e.g., "phrasal verbs", "idioms", "grammar")
3. Extract page numbers when visible
4. Generate unique IDs for each section

Return JSON:
{
  "title": "Book Title",
  "author": "Author Name (if found)",
  "bookSubject": "What this book teaches",
  "structure": [/* CATEGORIES with UNITS as children */]
}

Generate unique IDs for each section.

BOOK TEXT:
${text.substring(0, 100000)}

Return ONLY valid JSON, no markdown code blocks.`;

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
          temperature: 0.3,
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
    let parsed;
    try {
      // Remove potential markdown code blocks
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error("Failed to parse book structure from AI response");
    }

    // Ensure all chapters have IDs
    const ensureIds = (chapters: BookChapter[]): BookChapter[] => {
      return chapters.map((chapter) => ({
        ...chapter,
        id: chapter.id || generateId(),
        children: chapter.children ? ensureIds(chapter.children) : undefined,
      }));
    };

    const result = {
      title: parsed.title || "Untitled Book",
      author: parsed.author || undefined,
      bookSubject: parsed.bookSubject || undefined,
      structure: ensureIds(parsed.structure || []),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error extracting book structure:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to extract book structure" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
