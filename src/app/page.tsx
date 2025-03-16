"use client";

import { useState, FormEvent, useEffect } from "react";

export default function Home() {
  // Simplified state
  const [answers, setAnswers] = useState({
    name: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState<{ [key: string]: boolean }>({
    name: false
  });
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const recorder = new MediaRecorder(stream);
          recorder.addEventListener('dataavailable', (event) => {
            if (event.data.size > 0) {
              setAudioChunks(prev => [...prev, event.data]);
            }
          });
          setMediaRecorder(recorder);
          return () => {
            stream.getTracks().forEach(track => track.stop());
          };
        })
        .catch(err => {
          console.error('Error accessing microphone:', err);
          setError('Microphone access denied');
        });
    }
  }, []);

  const formatText = (text: string, field: string): string => {
    let formatted = text.trim();
    
    if (field === 'name') {
      // Capitalize each word
      formatted = formatted
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    return formatted;
  };

  const translateText = async (text: string): Promise<string> => {
    try {
      const response = await fetch('/api/translate', {  // Changed to use our own API endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          sourceLang: 'hi',
          targetLang: 'en',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Translation failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      return data.translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      setError(`Translation failed: ${error.message}`);
      return text; // Return original text on error
    }
  };

  const startRecording = async (field: string) => {
    if (!mediaRecorder) {
      setError('Recording is not supported in your browser');
      return;
    }

    setAudioChunks([]);
    setIsRecording(prev => ({ ...prev, [field]: true }));
    mediaRecorder.start(200);
  };

  const stopRecording = async (field: string) => {
    if (!mediaRecorder) return;

    return new Promise<void>((resolve) => {
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      }, { once: true });

      mediaRecorder.addEventListener('stop', async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (audioChunks.length === 0) {
            throw new Error('No audio data recorded');
          }

          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          console.log('Audio blob size:', audioBlob.size); // Debug log
          
          const reader = new FileReader();
          const base64Audio = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const base64 = reader.result as string;
              const base64Data = base64.split(',')[1];
              console.log('Base64 length:', base64Data.length); // Debug log
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          if (!base64Audio) {
            throw new Error('Failed to convert audio to base64');
          }

          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audio: base64Audio,
              encoding: 'WEBM_OPUS',
              languageCode: 'hi-IN',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Speech recognition failed');
          }

          const { transcript } = await response.json();
          const translatedText = await translateText(transcript);
          const formattedText = formatText(translatedText, field);
          handleInputChange(field, formattedText);
        } catch (error) {
          console.error('Processing error:', error);
          setError(`Failed to process speech: ${error.message}`);
        } finally {
          setAudioChunks([]); // Clear the chunks after processing
          resolve();
        }
      }, { once: true });

      mediaRecorder.stop();
    });
  };

  const handleRecordingClick = async (field: string) => {
    if (isRecording[field]) {
      await stopRecording(field);
      setIsRecording(prev => ({ ...prev, [field]: false }));
    } else {
      await startRecording(field);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate resume");
      }

      // Get the PDF blob directly from the response
      const pdfBlob = await response.blob();
      const url = window.URL.createObjectURL(pdfBlob);

      // Handle the PDF URL (e.g., download, display)
      console.log('Resume URL:', url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <main className="flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-center">Voice-Enabled Resume Generator</h1>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Name Field */}
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="font-medium">Full Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                id="name"
                value={answers.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="border rounded-md p-2 flex-1"
                required
              />
              <button
                type="button"
                onClick={() => handleRecordingClick('name')}
                className={`px-4 py-2 rounded-md ${
                  isRecording.name ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                {isRecording.name ? 'Stop' : 'Record'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 text-white py-2 px-4 hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? "Generating..." : "Generate Resume"}
          </button>
        </form>

        {error && (
          <div className="text-red-500 text-center">{error}</div>
        )}
      </main>
    </div>
  );
}
