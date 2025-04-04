"use client";

import { useState, FormEvent, useEffect } from "react";


export default function Home() {
  const jobSeekerQuestions = [
    { key: 'name', label: 'What is your full name?' },
    { key: 'education', label: 'What is your educational background?' },
    { key: 'age', label: 'What is your age?' },
    { key: 'location', label: 'Where are you located?' },
    { key: 'pastJobs', label: 'Tell me about your past jobs.' },
  ];

  const employerQuestions = [
    { key: 'companyName', label: 'What is your company name?' },
    { key: 'jobTitle', label: 'What position are you hiring for?' },
    { key: 'requirements', label: 'What are the key requirements for this role?' },
    { key: 'experience', label: 'How many years of experience are required?' },
    { key: 'location', label: 'Where is the job location?' },
  ];

  const [userRole, setUserRole] = useState<'employer' | 'jobseeker' | null>(null);
  const [step, setStep] = useState<'role-selection' | 'language-selection' | 'questionnaire'>('role-selection');
  
  // Update the questions state to use the appropriate question set
  const questions = userRole === 'employer' ? employerQuestions : jobSeekerQuestions;

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
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [employeeSuggestions, setEmployeeSuggestions] = useState<Array<{
    name: string;
    education: string;
    experience: string;
    matchScore: number;
  }>>([]);

  const languages: Array<{ code: string; name: string; label: string }> = [
    { code: 'bn-IN', name: 'বাংলা', label: 'Bengali' },
    { code: 'hi-IN', name: 'हिंदी', label: 'Hindi' },
    { code: 'ml-IN', name: 'മലയാളം', label: 'Malayalam' },
  ];

  const selectRole = (role: 'employer' | 'jobseeker') => {
    setUserRole(role);
    setStep('language-selection');
    // Reset any existing answers
    setAnswers({});
    setCurrentQuestionIndex(0);
    setAllQuestionsAnswered(false);
  };

  const selectLanguage = (languageCode: string) => {
    setDetectedLanguage(languageCode);
    setStep('questionnaire');
  };

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2000); // 2 seconds delay

    return () => clearTimeout(timer);
  }, []);

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

          // Only send to Google Sheets if this is the last question
          if (currentQuestionIndex === questions.length - 1) {
            try {
              const sheetsResponse = await fetch('/api/update-sheets', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  formType: userRole,
                  ...answers,
                }),
              });

              if (!sheetsResponse.ok) {
                console.error('Failed to update Google Sheets:', await sheetsResponse.text());
              }
            } catch (sheetsError) {
              console.error('Error updating Google Sheets:', sheetsError);
              // Don't throw the error to prevent interrupting the main flow
            }
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

  const fetchTopCandidates = async (requirements: string) => {
    try {
      const response = await fetch('/api/match-candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requirements,
          jobTitle: answers.jobTitle,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }

      const data = await response.json();
      setEmployeeSuggestions(data.candidates);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setError('Failed to fetch candidate suggestions');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      if (userRole === 'employer') {
        await fetchTopCandidates(answers.requirements);
      } else {
        // Existing resume generation code
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
        window.open(url, '_blank');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
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

  const handleNextClick = async () => {
    const currentField = questions[currentQuestionIndex].key;
    const currentAnswer = answers[currentField];
    
    if (!currentAnswer) return;

    setIsProcessing(true);
    try {
      // Only send to Google Sheets if this is the last question
      if (currentQuestionIndex === questions.length - 1) {
        const sheetsResponse = await fetch('/api/update-sheets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            formType: userRole,
            ...answers,
          }),
        });

        if (!sheetsResponse.ok) {
          console.error('Failed to update Google Sheets:', await sheetsResponse.text());
        }
      }

      // Move to next question
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setAllQuestionsAnswered(true);
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to process answer');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f172a] to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-full w-full mx-auto">
            <img src="/knotai.png" alt="KnotAI Logo" className="w-full h-full animate-pulse" />
          </div>
          <p className="text-purple-200 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f172a] to-gray-900">
        <div className="max-w-3xl mx-auto p-8">
          <main className="flex flex-col gap-10">
            {step === 'role-selection' ? (
              <div className="min-h-[80vh] flex items-center justify-center">
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl shadow-lg shadow-black/20 border border-gray-700/50 p-6 sm:p-12 space-y-12 w-full">
                  <div className="text-center space-y-3">
                    <h2 className="text-4xl font-bold text-purple-200">Please select your role</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    <button
                      onClick={() => selectRole('jobseeker')}
                      className="flex flex-col items-center justify-center p-8 rounded-xl
                        bg-gray-700/30 hover:bg-purple-500/30 transition-all duration-200
                        border border-gray-600/50 hover:border-purple-500/50 group"
                    >
                      <span className="text-4xl mb-3">👤</span>
                      <span className="text-2xl font-bold text-white">Job Seeker</span>
                      <span className="text-purple-200/80 mt-2">Looking for opportunities</span>
                    </button>

                    <button
                      onClick={() => selectRole('employer')}
                      className="flex flex-col items-center justify-center p-8 rounded-xl
                        bg-gray-700/30 hover:bg-purple-500/30 transition-all duration-200
                        border border-gray-600/50 hover:border-purple-500/50 group"
                    >
                      <span className="text-4xl mb-3">💼</span>
                      <span className="text-2xl font-bold text-white">Employer</span>
                      <span className="text-purple-200/80 mt-2">Hiring talent</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : step === 'language-selection' ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl shadow-lg shadow-black/20 border border-gray-700/50 p-6 sm:p-12 space-y-12">
                <div className="text-center space-y-3">
                  <div className="flex justify-center gap-4 mb-8">
                    <div className="space-y-6 w-full">
                      {/* Responsive word cloud infographic */}
                      <div className="relative h-48 sm:h-80 flex items-center justify-center mb-6">
                        {/* Large prominent words - adjusted for mobile */}
                        <div className="absolute text-yellow-400/60 text-4xl sm:text-7xl blur-[1px] animate-pulse">সফলতা</div>
                        <div className="absolute transform -rotate-6 text-green-400/60 text-3xl sm:text-6xl bottom-4 sm:bottom-8 left-12 sm:left-24 blur-[0.5px]">অভিজ্ঞতা</div>
                        <div className="absolute transform rotate-3 text-blue-400/60 text-3xl sm:text-6xl top-2 sm:top-4 right-10 sm:right-20 blur-[0.5px]">കഴിവുകൾ</div>
                        
                        {/* Medium-sized words - hidden on mobile, visible on larger screens */}
                        <div className="hidden sm:block absolute transform -rotate-12 text-purple-400/50 text-4xl left-12 top-8">नौकरी</div>
                        <div className="hidden sm:block absolute transform rotate-12 text-pink-400/50 text-4xl top-12 left-32">ലക്ഷ്യങ്ങൾ</div>
                        <div className="hidden sm:block absolute transform -rotate-20 text-cyan-400/50 text-4xl bottom-16 right-16">ভবিষ্যৎ</div>
                        <div className="hidden sm:block absolute transform rotate-3 text-orange-400/50 text-4xl top-8 left-16">വളർച്ച</div>
                        <div className="hidden sm:block absolute transform rotate-90 text-indigo-400/50 text-4xl bottom-4 right-36">विकास</div>
                        
                        {/* Background layer words - fewer shown on mobile */}
                        <div className="hidden sm:block absolute transform rotate-15 text-emerald-400/40 text-3xl top-2 left-48">শক্তি</div>
                        <div className="hidden sm:block absolute transform -rotate-25 text-rose-400/40 text-3xl bottom-20 left-8">প্রগতি</div>
                        <div className="hidden sm:block absolute transform rotate-8 text-amber-400/40 text-3xl top-16 right-8">വിജയം</div>
                        
                        {/* Additional background words - hidden on mobile */}
                        <div className="hidden sm:block absolute transform rotate-45 text-purple-400/30 text-2xl top-28 left-24">കೌಶಲ್ಯ</div>
                        <div className="hidden sm:block absolute transform -rotate-35 text-blue-400/30 text-2xl bottom-28 right-28">উন্নতি</div>
                        
                        {/* Central emoji with glow effect - responsive size */}
                        <div className="relative z-10">
                          <span className="text-6xl sm:text-9xl filter drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">💼</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
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
                      <input
                        type="text"
                        value={answers[questions[currentQuestionIndex].key] || ''}
                        onChange={(e) => handleInputChange(questions[currentQuestionIndex].key, e.target.value)}
                        className="w-full rounded-xl border-gray-700 bg-gray-900/50 p-4 text-gray-100 
                          focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                        placeholder="Type your answer..."
                      />

                      <div className="flex gap-4 w-full">
                        <button
                          type="button"
                          onClick={handleNextClick}
                          disabled={isProcessing || !answers[questions[currentQuestionIndex].key]}
                          className="w-full sm:w-auto px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white 
                            rounded-xl font-medium text-lg transition-all duration-200 ease-in-out 
                            shadow-lg shadow-purple-500/20 hover:shadow-xl disabled:opacity-50
                            border border-white/10 hover:border-white/20"
                        >
                          Next
                        </button>

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
                      </div>

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
                          <label className="text-xl font-semibold text-white">Review Your Input</label>
                          <textarea
                            value={Object.entries(answers).map(([key, value]) => 
                              `${questions.find(q => q.key === key)?.label}\n${value}\n`
                            ).join('\n')}
                            className="w-full min-h-[200px] rounded-xl border-gray-700 bg-gray-900/50 p-4 text-gray-100 
                              focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                            readOnly
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button
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
                                <span>{userRole === 'employer' ? 'Finding Matches...' : 'Generating...'}</span>
                              </div>
                            ) : (
                              userRole === 'employer' ? "Find Matching Candidates" : "Generate Resume"
                            )}
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setUserRole(null);
                              setStep('role-selection');
                              setAnswers({});
                              setCurrentQuestionIndex(0);
                              setAllQuestionsAnswered(false);
                              setEmployeeSuggestions([]);
                            }}
                            className="w-full sm:w-auto px-8 py-4 bg-gray-600 hover:bg-gray-700 text-white 
                              rounded-xl font-medium text-lg transition-all duration-200 ease-in-out 
                              shadow-lg shadow-gray-500/20 hover:shadow-xl hover:shadow-gray-500/30 
                              border border-white/10 hover:border-white/20"
                          >
                            Start Over
                          </button>
                        </div>
                      </form>

                      {userRole === 'employer' && employeeSuggestions.length > 0 && (
                        <div className="mt-8 space-y-6">
                          <h3 className="text-xl font-semibold text-white">Top Matching Candidates</h3>
                          <div className="grid gap-4 sm:grid-cols-3">
                            {employeeSuggestions.map((candidate, index) => (
                              <div key={index} className="bg-gray-700/30 rounded-xl p-6 border border-gray-600/50">
                                <div className="flex items-center justify-between mb-4">
                                  <span className="text-lg font-medium text-white">{candidate.name}</span>
                                  <span className="text-sm font-medium text-purple-400">
                                    {Math.round(candidate.matchScore)}% Match
                                  </span>
                                </div>
                                <div className="space-y-2 text-sm text-purple-200">
                                  <p><span className="text-purple-400">Education:</span> {candidate.education}</p>
                                  <p><span className="text-purple-400">Experience:</span> {candidate.experience}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
          
          {/* Add footnote */}
          <footer className="text-center py-6 text-purple-300/60 text-sm italic">
            Mauka - Empowering today&apos;s youth to elevate tomorrow&apos;s workforce
          </footer>
        </div>
      </div>
    </>
  );
}