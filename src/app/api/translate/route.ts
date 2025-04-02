import { NextResponse } from 'next/server';
import { v2 } from '@google-cloud/translate';
import fs from 'fs';
const { Translate } = v2;

const translate = new Translate({
  credentials: {
    client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL2,
    private_key: process.env.GCP_PRIVATE_KEY2,
  },
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
  } catch (error: unknown) {
    console.error('Translation error:', error);
    // Add type checking for the error object
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to translate text',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
} 