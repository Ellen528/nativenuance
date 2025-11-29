<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Features

### Export Analysis
Export your complete vocabulary analysis including all content and formatting:
- **PDF Export**: Download a PDF document with all your analyzed vocabulary, definitions, examples, and structure analysis
- **PNG Export**: Save a high-quality image of your entire analysis

The export button is located in the action buttons section after analyzing text. Simply click "Export" and choose your preferred format (PDF or PNG).
