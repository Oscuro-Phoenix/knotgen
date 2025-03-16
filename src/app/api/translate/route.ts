import { NextResponse } from 'next/server';
import { v2 } from '@google-cloud/translate';
import fs from 'fs';
const { Translate } = v2;

// Initialize with credentials from file
const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))
  : {};

const translate = new Translate({
  projectId: credentials.project_id,
  credentials: credentials,
});

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { text, sourceLang, targetLang } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log('Translating text:', { text, sourceLang, targetLang }); // Debug log

    const [translation] = await translate.translate(text, {
      from: sourceLang,
      to: targetLang,
    });

    console.log('Translation result:', translation); // Debug log

    return NextResponse.json({ translatedText: translation });
  } catch (error) {
    console.error('Translation error:', error);
    // Return more detailed error information
    return NextResponse.json(
      { 
        error: 'Failed to translate text',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 