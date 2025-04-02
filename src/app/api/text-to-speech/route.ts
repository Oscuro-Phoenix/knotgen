import { NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';



const client = new TextToSpeechClient({
    credentials: {
        client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL2,
        private_key: process.env.GCP_PRIVATE_KEY2,
      },
});

export async function POST(req: Request) {
  try {
    const { text, languageCode } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const request = {
      input: { text },
      voice: {
        languageCode: languageCode || 'hi-IN',
        name: 'hi-IN-Wavenet-A',
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        pitch: 0,
        speakingRate: 1,
      },
    };

    const response = await client.synthesizeSpeech(request);
    const audioContent = response[0].audioContent;

    if (!audioContent) {
      throw new Error('No audio content generated');
    }

    // Return the audio content as a blob
    return new Response(audioContent, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
} 