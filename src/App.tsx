import React, { useState, useCallback } from 'react';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Upload, Circle, AlertCircle, Camera, Star, Printer, Twitter } from 'lucide-react';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [score, setScore] = useState<number | null>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      
      // Check file size (max 4MB)
      if (file.size > 4 * 1024 * 1024) {
        setError('Image size should be less than 4MB');
        return;
      }
      
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setError('');
      setAnalysis('');
      setScore(null);
    }
  }, []);

  const validateApiKey = (key: string) => {
    return key.trim().length > 0;
  };

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedAnalysis = analysis.split('\n')
      .filter(line => !line.startsWith('Score:'))
      .map(line => {
        if (line.startsWith('Analysis:')) {
          return `<h2 class="section-title">Detailed Analysis</h2>`;
        }
        if (line.startsWith('Tips:')) {
          return `<h2 class="section-title">Tips for Improvement</h2>`;
        }
        return `<p class="analysis-text">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
      })
      .join('');

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const certificateHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>RotiChecker AI Certificate</title>
          <style>
            @media print {
              @page {
                margin: 0.5in;
              }
            }
            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #1f2937;
              background-color: #fff9f5;
              margin: 0;
              padding: 40px;
              position: relative;
              overflow: hidden;
            }
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 60px;
              color: rgba(194, 65, 12, 0.1);
              white-space: nowrap;
              pointer-events: none;
              z-index: 1000;
              font-weight: bold;
              user-select: none;
            }
            .certificate {
              position: relative;
              z-index: 1;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              background-color: white;
              border: 2px solid #c2410c;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              font-size: 36px;
              color: #c2410c;
              margin-bottom: 20px;
              font-weight: bold;
              text-align: center;
            }
            .score {
              font-size: 48px;
              color: #ea580c;
              margin: 20px 0;
              text-align: center;
            }
            .section-title {
              font-size: 24px;
              color: #9a3412;
              margin: 30px 0 15px;
              padding-bottom: 8px;
              border-bottom: 2px solid #fdba74;
            }
            .analysis-text {
              margin: 10px 0;
              color: #4b5563;
            }
            .date {
              margin-top: 40px;
              color: #666;
              text-align: center;
              font-style: italic;
            }
            .image-container {
              text-align: center;
              margin: 20px 0;
            }
            .roti-image {
              max-width: 300px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            @media print {
              body {
                background-color: white;
              }
              .certificate {
                border: none;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="watermark">@sagevedant</div>
          <div class="certificate">
            <div class="header">RotiChecker AI Certificate</div>
            ${preview ? `
              <div class="image-container">
                <img src="${preview}" alt="Roti" class="roti-image" />
              </div>
            ` : ''}
            <div class="score">Score: ${score}/10</div>
            <div class="analysis">
              ${formattedAnalysis}
            </div>
            <div class="date">Issued on ${currentDate}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(certificateHtml);
    printWindow.document.close();
    
    // Wait for images to load before printing
    if (preview) {
      const img = printWindow.document.querySelector('img');
      if (img) {
        img.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }
    } else {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }, [preview, score, analysis]);

  const analyzeRoti = async () => {
    if (!apiKey || !validateApiKey(apiKey)) {
      setError('Please enter a valid Gemini API key');
      return;
    }
    if (!image) {
      setError('Please upload an image of your roti');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const imageData = await fileToGenerativePart(image);

      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      });

      const prompt = `Analyze this roti (Indian flatbread) image in detail and provide a comprehensive evaluation of its roundness. Please provide an in-depth analysis covering:

1. Shape Analysis:
   - Precise evaluation of circularity
   - Measurement of edge consistency
   - Analysis of symmetry
   - Identification of any irregular areas
   - Assessment of diameter consistency

2. Edge Quality:
   - Detailed examination of edge smoothness
   - Analysis of crust formation
   - Evaluation of thickness consistency along edges
   - Identification of any uneven areas

3. Professional Assessment:
   - Comparison to professional standards
   - Impact of shape on overall quality
   - Technical observations about the rolling technique
   - Specific areas needing improvement

Provide:
1. A numerical score from 1 to 10 (where 10 is perfectly round)
2. A detailed explanation of the score with specific observations
3. A comprehensive analysis of strengths and weaknesses
4. Specific, actionable tips for improvement based on the observed issues

Format the response as:
Score: [number]
Analysis: [your detailed technical analysis with specific observations]
Tips: [detailed, technique-focused improvement suggestions]

Please be specific and technical in your analysis, avoiding general statements.`;

      const result = await model.generateContent([prompt, imageData]);
      
      if (!result || !result.response) {
        throw new Error('Failed to get a response from the AI model');
      }
      
      const response = result.response;
      const text = response.text();
      
      if (!text) {
        throw new Error('Received empty response from the AI model');
      }
      
      const scoreMatch = text.match(/Score:\s*(\d+)/);
      if (scoreMatch) {
        const parsedScore = parseInt(scoreMatch[1], 10);
        if (parsedScore >= 1 && parsedScore <= 10) {
          setScore(parsedScore);
        } else {
          console.warn('Invalid score received:', parsedScore);
        }
      }
      
      setAnalysis(text);
    } catch (err) {
      console.error('Analysis error:', err);
      
      let errorMessage = 'Error analyzing image. ';
      
      if (err instanceof Error) {
        if (err.message.includes('API key')) {
          errorMessage += 'Invalid API key. Please check your API key and try again.';
        } else if (err.message.includes('PERMISSION_DENIED')) {
          errorMessage += 'API key does not have permission to access the Gemini Vision API.';
        } else if (err.message.includes('QUOTA_EXCEEDED')) {
          errorMessage += 'API quota exceeded. Please try again later.';
        } else if (err.message.includes('SAFETY')) {
          errorMessage += 'The image was flagged by safety filters. Please try a different image.';
        } else {
          errorMessage += err.message;
        }
      } else if (typeof err === 'object' && err !== null) {
        errorMessage += Object.prototype.toString.call(err);
      } else {
        errorMessage += 'An unexpected error occurred. Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  async function fileToGenerativePart(file: File): Promise<{
    inlineData: {
      data: string;
      mimeType: string;
    };
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Failed to read image file - invalid result type'));
          return;
        }
        
        const base64Data = result.split(',')[1];
        if (!base64Data) {
          reject(new Error('Failed to read image file - invalid base64 data'));
          return;
        }
        
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      };
      reader.onerror = () => {
        reject(new Error('Failed to read image file - ' + (reader.error?.message || 'unknown error')));
      };
      reader.readAsDataURL(file);
    });
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex justify-center gap-1 mb-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
          <Star
            key={star}
            className={`w-6 h-6 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 relative">
      {/* Twitter Link */}
      <a
        href="https://x.com/sagevedant"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-4 flex items-center gap-2 text-orange-600 hover:text-orange-700 transition-colors"
      >
        <Twitter className="h-5 w-5" />
        <span className="font-medium">@sagevedant</span>
      </a>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Camera className="h-12 w-12 text-orange-600" />
            </div>
            <h1 className="text-4xl font-bold text-orange-800 mb-2 font-serif">RotiChecker AI</h1>
            <p className="text-orange-600 font-medium">Rate your roti's roundness with AI precision</p>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gemini API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter your Gemini API key"
              />
              <p className="mt-1 text-sm text-gray-500">
                Your API key is processed locally and never stored
              </p>
            </div>

            <div className="mb-6">
              <div className="border-2 border-dashed border-orange-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="h-12 w-12 text-orange-500 mb-2" />
                  <span className="text-sm text-gray-600">
                    Click to upload your roti photo
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Max size: 4MB
                  </span>
                </label>
              </div>
            </div>

            {preview && (
              <div className="mb-6">
                <img
                  src={preview}
                  alt="Roti preview"
                  className="max-w-full h-auto rounded-lg"
                />
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {error}
              </div>
            )}

            <button
              onClick={analyzeRoti}
              disabled={loading || !image || !apiKey}
              className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                loading || !image || !apiKey
                  ? 'bg-gray-400'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Circle className="animate-spin h-5 w-5 mr-2" />
                  Analyzing...
                </div>
              ) : (
                'Analyze Roti'
              )}
            </button>
          </div>

          {analysis && (
            <div className="bg-white rounded-lg shadow-xl p-8">
              <div className="relative">
                <div className="absolute top-0 right-0">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 py-2 px-4 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors font-medium"
                  >
                    <Printer className="h-5 w-5" />
                    Print Certificate
                  </button>
                </div>
                
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-orange-800 mb-2 font-serif">
                    Analysis Results
                  </h2>
                  <div className="w-16 h-1 bg-orange-500 mx-auto rounded-full"></div>
                </div>

                {score !== null && (
                  <div className="mb-8 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6">
                    <div className="text-6xl font-bold text-center text-orange-600 font-serif mb-3">
                      {score}/10
                    </div>
                    {renderStars(score)}
                    <div className="text-center text-orange-800 font-medium mt-2">
                      Roundness Score
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  {analysis.split('\n').map((line, i) => {
                    if (line.startsWith('Analysis:')) {
                      return (
                        <div key={i} className="border-l-4 border-orange-500 pl-4">
                          <h3 className="text-xl font-semibold text-orange-800 mb-3">
                            Detailed Analysis
                          </h3>
                        </div>
                      );
                    }
                    if (line.startsWith('Tips:')) {
                      return (
                        <div key={i} className="border-l-4 border-orange-500 pl-4">
                          <h3 className="text-xl font-semibold text-orange-800 mb-3">
                            Tips for Improvement
                          </h3>
                        </div>
                      );
                    }
                    if (line.startsWith('Score:')) {
                      return null;
                    }
                    if (line.trim() === '') {
                      return null;
                    }
                    return (
                      <p key={i} className="text-gray-700 leading-relaxed pl-4">
                        {line}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;