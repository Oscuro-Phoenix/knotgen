"use client";

import { useState, useEffect } from "react";


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
  const [isFoundersModalOpen, setIsFoundersModalOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tempAnswer, setTempAnswer] = useState('');

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
          recorder.addEventListener('dataavailable', (event: BlobEvent) => {
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
      // Don't translate name and location fields
      const currentField = questions[currentQuestionIndex].key;
      if (currentField === 'name' || currentField === 'location') {
        return text;
      }

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
          console.log('Audio blob size:', audioBlob.size);
          
          const reader = new FileReader();
          const base64Audio = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const base64 = reader.result as string;
              const base64Data = base64.split(',')[1];
              console.log('Base64 length:', base64Data.length);
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
          // Set the original transcript in the temp answer
          setTempAnswer(transcript);
          
          // Translate and format for internal storage
          const translatedText = await translateText(transcript);
          const formattedText = formatText(translatedText, currentField);

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
                  [currentField]: formattedText, // Use the translated and formatted text for storage
                }),
              });

              if (!sheetsResponse.ok) {
                console.error('Failed to update Google Sheets:', await sheetsResponse.text());
              }
            } catch (sheetsError) {
              console.error('Error updating Google Sheets:', sheetsError);
            }
          }

          // After successful recording, show confirmation
          setShowConfirmation(true);

        } catch (error) {
          console.error('Processing error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Speech processing failed';
          setError(`Failed to process speech: ${errorMessage}`);
        } finally {
          setAudioChunks([]);
          setIsProcessing(false);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      if (userRole === 'employer') {
        await fetchTopCandidates(answers.requirements);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setTempAnswer(value);
  };

  const confirmAnswer = async () => {
    try {
      // Translate the answer before storing it
      const translatedAnswer = await translateText(tempAnswer);
      const formattedAnswer = formatText(translatedAnswer, questions[currentQuestionIndex].key);
      
      const updatedAnswers = {
        ...answers,
        [questions[currentQuestionIndex].key]: formattedAnswer
      };
      setAnswers(updatedAnswers);
      
      setShowConfirmation(false);
      setTempAnswer('');
      
      // Check if this was the last question
      if (currentQuestionIndex === questions.length - 1) {
        setAllQuestionsAnswered(true);
        // Send all answers to Google Sheets
        try {
          const sheetsResponse = await fetch('/api/update-sheets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              formType: userRole,
              ...updatedAnswers, // Send complete updated answers
            }),
          });

          if (!sheetsResponse.ok) {
            console.error('Failed to update Google Sheets:', await sheetsResponse.text());
          }
        } catch (sheetsError) {
          console.error('Error updating Google Sheets:', sheetsError);
        }
      } else {
        // Move to next question if not the last one
        setCurrentQuestionIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error translating answer:', error);
      setError('Failed to process answer');
    }
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
    if (!tempAnswer) return;
    setShowConfirmation(true);
  };

  const founders = [
    {
      name: "Shakul Pathak",
      role: "Co-Founder",
      image: "/founders/shakulp.jpg",
      linkedin: "https://linkedin.com/in/shakul-pathak",
    },
    {
      name: "Anup Sreekumar",
      role: "Co-Founder",
      image: "/founders/anupsk.jpg",
      linkedin: "https://linkedin.com/in/anup-sreekumar",
    },
    // Add more founders as needed
  ];

  const FoundersModal = (): JSX.Element | null => {
    if (!isFoundersModalOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white text-center flex-grow">Who Are We?</h2>
              <button
                onClick={() => setIsFoundersModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {founders.map((founder) => (
                <div key={founder.name} className="flex flex-col items-center text-center space-y-4">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-purple-500/30">
                    <img
                      src={founder.image}
                      alt={founder.name}
                      className="object-cover w-full h-full"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.src = "https://www.gravatar.com/avatar/?d=mp";
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-medium text-white">{founder.name}</h4>
                    <p className="text-purple-300">{founder.role}</p>
                    <a
                      href={founder.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                      <span>Connect on LinkedIn</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WelcomeModal = (): JSX.Element | null => {
    if (!showWelcomeModal) return null;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800/90 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
              <div className="w-32 mx-auto flex justify-center">
                <img src="/knotai.png" alt="KnotAI Logo" className="w-full h-full" />
              </div>
              <button
                onClick={() => setShowWelcomeModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-purple-300">Welcome to Mauka</h2>
              
              <div className="space-y-4 text-lg text-purple-100">
                <p>
                  Mauka is a revolutionary platform bridging the gap between employers and job seekers 
                  across language barriers. We understand that talent knows no linguistic boundaries, 
                  which is why we have created a seamless experience for both job seekers and employers.
                </p>
                
                <div className="bg-purple-500/10 rounded-xl p-6 border border-purple-500/20">
                  <h3 className="text-xl font-semibold text-purple-300 mb-3">Our Mission</h3>
                  <p className="text-purple-100">
                    We help employers get their next hire in days instead of weeks as job seekers from 
                    diverse linguistic backgrounds register in minutes.
                  </p>
                </div>

                <h3 className="text-xl font-semibold text-purple-300">What We Offer:</h3>
                <ul className="space-y-3 list-disc list-inside">
                  <li>Multi-language support for inclusive hiring</li>
                  <li>Voice-enabled form filling for easier access</li>
                  <li>Smart candidate matching for employers</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowWelcomeModal(false)}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white rounded-xl py-4 px-6 
                text-lg font-medium transition-all duration-200 flex items-center justify-center gap-2"
            >
              Get Started
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add type for the translations object
  type TranslatedText = {
    confirmationQuestion: string;
    yes: string;
    no: string;
    response: string;
    startOver: string;
  };

  type TranslationDictionary = {
    [key: string]: TranslatedText;
  };

  const getTranslatedText: TranslationDictionary = {
    'bn-IN': {
      confirmationQuestion: 'এই উত্তরটি কি সঠিক?',
      yes: 'হ্যাঁ, চালিয়ে যান',
      no: 'না, সম্পাদনা করুন',
      response: 'আপনার উত্তর',
      startOver: 'নতুন করে শুরু করুন'
    },
    'hi-IN': {
      confirmationQuestion: 'क्या यह जवाब सही है?',
      yes: 'हाँ, जारी रखें',
      no: 'नहीं, संपादित करें',
      response: 'आपका जवाब',
      startOver: 'फिर से शुरू करें'
    },
    'ml-IN': {
      confirmationQuestion: 'ഈ উত্তরം ശരിയാണോ?',
      yes: 'അതെ, തുടരുക',
      no: 'അല്ല, എഡിറ്റ് ചെയ്യുക',
      response: 'നിങ്ങളുടെ ഉത്തരം',
      startOver: 'വീണ്ടും തുടങ്ങുക'
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
              <div className="min-h-[40vh] flex items-center justify-center pt-4">
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl shadow-lg shadow-black/20 border border-gray-700/50 p-6 sm:p-12 space-y-12 w-full">
                  <div className="text-center space-y-3">
                    <h2 className="text-4xl font-bold text-purple-200">What are you looking for?</h2>
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

                  <div className="flex justify-center">
                    <button
                      onClick={() => setIsFoundersModalOpen(true)}
                      className="px-6 py-3 bg-purple-500/20 text-purple-200 rounded-xl
                        hover:bg-purple-500/30 transition-all duration-200
                        border border-purple-500/30 hover:border-purple-500/50
                        flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Learn About Us
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
                        value={tempAnswer}
                        onChange={(e) => handleInputChange(questions[currentQuestionIndex].key, e.target.value)}
                        className="w-full rounded-xl border-gray-700 bg-gray-900/50 p-4 text-gray-100 
                          focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                        placeholder="Type your answer..."
                      />

                      {showConfirmation ? (
                        <div className="w-full space-y-4">
                          <div className="bg-purple-500/20 rounded-xl p-4 border border-purple-500/30">
                            <p className="text-purple-200 mb-2">
                              {getTranslatedText[detectedLanguage]?.confirmationQuestion || 'Is this response correct?'}
                            </p>
                            <p className="text-white font-medium">
                              {getTranslatedText[detectedLanguage]?.response || 'Your response'}: {tempAnswer}
                            </p>
                          </div>
                          
                          <div className="flex gap-4">
                            <button
                              onClick={confirmAnswer}
                              className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl
                                transition-colors duration-200 font-medium"
                            >
                              {getTranslatedText[detectedLanguage]?.yes || 'Yes, Continue'}
                            </button>
                            <button
                              onClick={() => setShowConfirmation(false)}
                              className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl
                                transition-colors duration-200 font-medium"
                            >
                              {getTranslatedText[detectedLanguage]?.no || 'No, Edit'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-4 w-full">
                          <button
                            type="button"
                            onClick={handleNextClick}
                            disabled={isProcessing || !tempAnswer}
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
                      )}

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
                          {userRole === 'employer' && (
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
                                  <span>Finding Matches...</span>
                                </div>
                              ) : (
                                "Find Matching Candidates"
                              )}
                            </button>
                          )}
                          
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
                            {detectedLanguage ? getTranslatedText[detectedLanguage]?.startOver : 'Start Over'}
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
          
          <footer className="py-12">
            <div className="max-w-3xl mx-auto">
              <div className="text-center text-purple-300/60 text-sm italic">
                Mauka - Empowering today&apos;s youth to elevate tomorrow&apos;s workforce
              </div>
            </div>
          </footer>
        </div>
      </div>
      <WelcomeModal />
      <FoundersModal />
    </>
  );
}