"use client";

import { useState, FormEvent, useEffect } from "react";

export default function Home() {
  const questions = [
    { key: 'name', label: 'What is your full name?' },
    { key: 'education', label: 'What is your educational background?' },
    { key: 'age', label: 'What is your age?' },
    { key: 'location', label: 'Where are you located?' },
    { key: 'pastJobs', label: 'Tell me about your past jobs.' },
  ];

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    name: '',
    education: '',
    age: '',
    location: '',
    pastJobs: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translatedQuestions, setTranslatedQuestions] = useState<string[]>([]);
  const [step, setStep] = useState<'language-selection' | 'questionnaire'>('language-selection');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');

  const languages: Array<{ code: string; name: string; label: string }> = [
    { code: 'bn-IN', name: 'বাংলা', label: 'Bengali' },
    { code: 'hi-IN', name: 'हिंदी', label: 'Hindi' },
    { code: 'ml-IN', name: 'മലയാളം', label: 'Malayalam' },
  ];

  const selectLanguage = (languageCode: string) => {
    setDetectedLanguage(languageCode);
    setStep('questionnaire');
  };

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

  useEffect(() => {
    const translateQuestions = async () => {
      try {
        const translations = await Promise.all(
          questions.map(async (q) => {
            const response = await fetch('/api/translate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: q.label,
                sourceLang: 'en',
                targetLang: detectedLanguage?.split('-')[0] || 'hi',
              }),
            });
            const data = await response.json();
            return data.translatedText;
          })
        );
        setTranslatedQuestions(translations);
      } catch (error) {
        console.error('Error translating questions:', error);
        setError('Failed to translate questions');
      }
    };

    if (detectedLanguage) {
      translateQuestions();
    }
  }, [detectedLanguage]);

  const formatText = (text: string, field: string): string => {
    let formatted = text.trim();
    
    switch (field) {
      case 'name':
      case 'location':
        // Capitalize each word
        formatted = formatted
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        break;
      case 'age':
        // Extract numbers only
        formatted = formatted.replace(/\D/g, '');
        break;
      default:
        // Keep original formatting for other fields
        break;
    }
    return formatted;
  };

  const translateText = async (text: string): Promise<string> => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          sourceLang: detectedLanguage?.split('-')[0] || 'hi',
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Translation failed: ${errorMessage}`);
      return text; // Return original text on error
    }
  };

  const startRecording = async () => {
    if (!mediaRecorder) {
      setError('Recording is not supported in your browser');
      return;
    }

    setAudioChunks([]);
    setIsRecording(true);
    mediaRecorder.start(200);
  };

  const stopRecording = async () => {
    if (!mediaRecorder) return;

    const currentField = questions[currentQuestionIndex].key;
    setIsProcessing(true);
    
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
              languageCode: detectedLanguage || 'hi-IN',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Speech recognition failed');
          }

          const { transcript } = await response.json();
          const translatedText = await translateText(transcript);
          const formattedText = formatText(translatedText, currentField);
          handleInputChange(currentField, formattedText);

          // Add Google Sheets posting
          try {
            const sheetsResponse = await fetch('/api/update-sheets', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                field: currentField,
                originalText: transcript,
                translatedText: translatedText,
                formattedText: formattedText,
                timestamp: new Date().toISOString(),
              }),
            });

            if (!sheetsResponse.ok) {
              console.error('Failed to update Google Sheets:', await sheetsResponse.text());
            }
          } catch (sheetsError) {
            console.error('Error updating Google Sheets:', sheetsError);
            // Don't throw the error to prevent interrupting the main flow
          }

          // After successful recording, move to next question
          if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
          } else {
            setAllQuestionsAnswered(true);
          }

        } catch (error) {
          console.error('Processing error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Speech processing failed';
          setError(`Failed to process speech: ${errorMessage}`);
        } finally {
          setAudioChunks([]); // Clear the chunks after processing
          setIsProcessing(false); // Hide loading indicator
          resolve();
        }
      }, { once: true });

      mediaRecorder.stop();
    });
  };

  const handleRecordingClick = async () => {
    if (isRecording) {
      await stopRecording();
      setIsRecording(false);
    } else {
      await startRecording();
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
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

      const pdfBlob = await response.blob();
      const url = window.URL.createObjectURL(pdfBlob);
      
      // Open PDF in new tab
      window.open(url, '_blank');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate resume';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const speakQuestion = async () => {
    try {
      const currentTranslatedQuestion = translatedQuestions[currentQuestionIndex];
      if (!currentTranslatedQuestion) return;

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: currentTranslatedQuestion,
          languageCode: detectedLanguage || 'hi-IN',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to play audio';
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f172a] to-gray-900">
      <div className="max-w-3xl mx-auto p-8">
        <main className="flex flex-col gap-10">
          {step === 'language-selection' ? (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl shadow-lg shadow-black/20 border border-gray-700/50 p-12 space-y-12">
              <div className="text-center space-y-3">
                <div className="flex justify-center gap-4 mb-8">
                  <div className="space-y-6">
                    {/* Multilingual word cloud infographic */}
                    <div className="relative h-80 flex items-center justify-center mb-6">
                      {/* Large prominent words */}
                      <div className="absolute text-yellow-400/60 text-7xl blur-[1px] animate-pulse">सफलता</div>
                      <div className="absolute transform -rotate-6 text-green-400/60 text-6xl bottom-8 left-24 blur-[0.5px]">অভিজ্ঞতা</div>
                      <div className="absolute transform rotate-3 text-blue-400/60 text-6xl top-4 right-20 blur-[0.5px]">കഴിവുകൾ</div>
                      
                      {/* Medium-sized words */}
                      <div className="absolute transform -rotate-12 text-purple-400/50 text-4xl left-12 top-8">नौकरी</div>
                      <div className="absolute transform rotate-12 text-pink-400/50 text-4xl top-12 left-32">ലക്ഷ്യങ്ങൾ</div>
                      <div className="absolute transform -rotate-20 text-cyan-400/50 text-4xl bottom-16 right-16">ভবিষ্যৎ</div>
                      <div className="absolute transform rotate-3 text-orange-400/50 text-4xl top-8 left-16">വളർച്ച</div>
                      <div className="absolute transform rotate-90 text-indigo-400/50 text-4xl bottom-4 right-36">विकास</div>
                      
                      {/* Background layer words */}
                      <div className="absolute transform rotate-15 text-emerald-400/40 text-3xl top-2 left-48">শক্তি</div>
                      <div className="absolute transform -rotate-25 text-rose-400/40 text-3xl bottom-20 left-8">प्रगति</div>
                      <div className="absolute transform rotate-8 text-amber-400/40 text-3xl top-16 right-8">വിജയം</div>
                      <div className="absolute transform -rotate-15 text-teal-400/40 text-3xl bottom-12 right-24">কর্ম</div>
                      <div className="absolute transform rotate-30 text-fuchsia-400/40 text-3xl top-20 right-48">ज्ञान</div>
                      <div className="absolute transform -rotate-8 text-lime-400/40 text-3xl bottom-24 left-40">അറിവ്</div>
                      <div className="absolute transform rotate-20 text-violet-400/40 text-3xl top-4 left-60">পেশা</div>
                      <div className="absolute text-sky-400/40 text-3xl right-52">योग्यता</div>
                      
                      {/* Additional background words */}
                      <div className="absolute transform rotate-45 text-purple-400/30 text-2xl top-28 left-24">ಕೌಶಲ್ಯ</div>
                      <div className="absolute transform -rotate-35 text-blue-400/30 text-2xl bottom-28 right-28">উন্নতি</div>
                      <div className="absolute transform rotate-15 text-green-400/30 text-2xl top-16 right-36">समृद्धि</div>
                      <div className="absolute transform -rotate-12 text-pink-400/30 text-2xl bottom-16 left-36">വിദ്യ</div>
                      <div className="absolute transform rotate-25 text-yellow-400/30 text-2xl top-32 right-24">মূল্য</div>
                      <div className="absolute transform -rotate-20 text-cyan-400/30 text-2xl bottom-32 left-28">आशा</div>
                      
                      {/* Central emoji with glow effect */}
                      <div className="relative z-10">
                        <span className="text-9xl filter drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">💼</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => selectLanguage(lang.code)}
                    disabled={isProcessing}
                    className={`flex flex-col items-center justify-center p-8 rounded-xl
                      bg-gray-700/30 hover:bg-purple-500/30 transition-all duration-200
                      border border-gray-600/50 hover:border-purple-500/50
                      group disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="text-4xl font-bold text-white mb-3">{lang.name}</span>
                    <span className="text-lg text-purple-200/80 group-hover:text-purple-100">{lang.label}</span>
                  </button>
                ))}
                    
              </div>
            </div>
          ) : (
            <>
              {!allQuestionsAnswered ? (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg shadow-black/20 border border-gray-700/50 p-8 space-y-8">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-purple-400 uppercase tracking-wide">
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </p>
                    <h2 className="text-2xl font-semibold text-white">
                      {questions[currentQuestionIndex].label}
                    </h2>
                    {translatedQuestions[currentQuestionIndex] && (
                      <p className="text-lg text-purple-200 mt-2">
                        {translatedQuestions[currentQuestionIndex]}
                      </p>
                    )}
                    <button
                      onClick={speakQuestion}
                      className="mt-4 px-4 py-2 bg-purple-500/20 text-purple-200 rounded-lg 
                        hover:bg-purple-500/30 transition-colors duration-200 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.25h.75a2 2 0 012 2v5.5a2 2 0 01-2 2H6.5a2 2 0 01-2-2v-5.5a2 2 0 012-2z" />
                      </svg>
                      Listen to Question
                    </button>
                  </div>
                  
                  <div className="flex flex-col items-center gap-6">
                    <button
                      type="button"
                      onClick={handleRecordingClick}
                      disabled={isProcessing}
                      className={`
                        w-full sm:w-auto px-8 py-4 rounded-xl font-medium text-lg
                        transition-all duration-200 ease-in-out
                        ${isRecording 
                          ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                          : 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/20'
                        }
                        disabled:opacity-50 shadow-lg hover:shadow-xl
                        border border-white/10 hover:border-white/20
                      `}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {isRecording ? (
                          <>
                            <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                            Stop Recording
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            Start Recording
                          </>
                        )}
                      </div>
                    </button>

                    {isProcessing && (
                      <div className="flex items-center gap-3 text-purple-200">
                        <svg
                          className="animate-spin h-5 w-5 text-purple-400"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span className="font-medium">Processing your response...</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg shadow-black/20 border border-gray-700/50 p-8 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-semibold text-white">Thank You for Your Responses!</h2>
                      <p className="text-purple-200/80">Your information has been successfully recorded.</p>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg shadow-black/20 border border-gray-700/50 p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-4">
                        <label className="text-xl font-semibold text-white">Review Your Answers</label>
                        <textarea
                          value={Object.entries(answers).map(([key, value]) => 
                            `${questions.find(q => q.key === key)?.label}\n${value}\n`
                          ).join('\n')}
                          className="w-full min-h-[300px] rounded-xl border-gray-700 bg-gray-900/50 p-4 text-gray-100 
                            focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                          readOnly
                        />
                      </div>
                      { <button
                        type="submit"
                        disabled={isProcessing}
                        className="w-full sm:w-auto px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white 
                          rounded-xl font-medium text-lg transition-all duration-200 ease-in-out 
                          shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 
                          disabled:opacity-50 disabled:hover:bg-purple-500
                          border border-white/10 hover:border-white/20"
                      >
                        {isProcessing ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Generating...</span>
                          </div>
                        ) : (
                          "Generate Resume?"
                        )}
                      </button> }
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="bg-red-900/50 text-red-200 p-4 rounded-xl text-center font-medium border border-red-700/50">
              {error}
            </div>
          )}

    
        </main>
      </div>
    </div>
  );
}