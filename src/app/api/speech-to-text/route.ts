import { NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';

const client = new SpeechClient({
  credentials: {
    client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY,
  },
});

export async function POST(req: Request) {
  try {
    const { audio, encoding, languageCode } = await req.json();

    const request = {
      audio: {
        content: audio,
      },
      config: {
        encoding: encoding,
        languageCode: languageCode,
        model: 'default',
        sampleRateHertz: 48000,
      },
    };

    const [response] = await client.recognize(request);
    const transcript = response.results
      ?.map(result => result.alternatives?.[0]?.transcript)
      .join(' ');

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error('Speech-to-text error:', error);
    return NextResponse.json(
      { error: 'Failed to process speech' },
      { status: 500 }
    );
  }
} 