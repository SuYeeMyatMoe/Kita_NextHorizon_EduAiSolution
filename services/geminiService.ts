
import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { AnalysisResponse, QuizQuestion } from "../types";
// @ts-ignore
import mammoth from "mammoth";

const SYSTEM_INSTRUCTION = `
## SYSTEM IDENTITY
You are **NextHorizon AI**, a specialized educational assessment engine designed for the Malaysian education context (SPM/STPM/IGCSE). Your role is to act as a supportive but rigorous academic evaluator.

## CORE OBJECTIVES
1.  **Analyze**: Evaluate student submissions (text, documents, images, video context) against a specific [ASSIGNMENT PROMPT] and [TEACHER RUBRIC].
2.  **Grade**: Assign scores strictly based on the rubric criteria. Avoid bias.
3.  **Feedback**: Provide actionable, specific feedback. Identify exactly *what* is missing or *why* a score was given.
4.  **Integrity Check**: Analyze stylometry, phrasing, and logic flow to estimate the likelihood of AI generation and potential plagiarism.

## OPERATIONAL RULES
-   **Context Awareness**: If the input is in Bahasa Melayu, output in Bahasa Melayu. Otherwise, default to English.
-   **Precision**: Quote specific parts of the submission when explaining gaps.
-   **Constructive Tone**: Use "Encouraging" for good work, "Constructive" for average, and "Urgent" for failing or risky work.
-   **Video Analysis**: If a YouTube link is present, use the Google Search tool data to evaluate the video's relevance and content against the rubric.

## OUTPUT FORMAT
You must return a raw JSON object matching the schema provided. Do not output markdown code blocks. 
If you are unable to analyze the content (e.g., video not found), return a JSON object with scores of 0 and the error reason in 'critical_gaps'.
`;

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Brief 2-sentence overview of the student's work." },
    score: {
      type: Type.OBJECT,
      properties: {
        earned: { type: Type.NUMBER },
        total: { type: Type.NUMBER },
        percentage: { type: Type.NUMBER },
      },
      required: ["earned", "total", "percentage"],
    },
    rubric_breakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING },
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
        },
        required: ["criterion", "score", "feedback"],
      },
    },
    critical_gaps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    personalized_recommendation: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of 3 specific actionable steps.",
    },
    sentiment: {
      type: Type.STRING,
      enum: ["Encouraging", "Constructive", "Urgent"],
    },
    plagiarism_score: { 
      type: Type.NUMBER, 
      description: "Estimated percentage of plagiarized content (0-100)." 
    },
    ai_probability: { 
      type: Type.NUMBER, 
      description: "Estimated percentage likelihood of AI-generated content (0-100)." 
    },
  },
  required: [
    "summary", 
    "score", 
    "rubric_breakdown", 
    "critical_gaps", 
    "personalized_recommendation", 
    "sentiment",
    "plagiarism_score", 
    "ai_probability"
  ],
};

const studyAidSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "A concise, engaging summary of the material (max 100 words)." },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          front: { type: Type.STRING, description: "Question or Term" },
          back: { type: Type.STRING, description: "Answer or Definition" }
        },
        required: ["front", "back"]
      },
      description: "Generate 5-10 high quality flashcards for revision."
    }
  },
  required: ["summary", "flashcards"]
};

// Retry Helper
const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = 
      error?.status === 429 || 
      error?.code === 429 || 
      (error?.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')));

    if (isRateLimit && retries > 0) {
      console.warn(`Gemini API Rate Limit hit. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Helper for DOCX conversion
function base64ToArrayBuffer(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

const filterSupportedFiles = (files: Array<{ data: string; mimeType: string }>) => {
  const SUPPORTED_PREFIXES = [
    'image/', 'audio/', 'text/', 'application/pdf'
  ];
  // Removed wordprocessingml from unsupported list as we handle it manually now
  const UNSUPPORTED_SUBSTRINGS = [
    'spreadsheetml', 'presentationml'
  ];

  return files.filter(f => {
    // Explicitly allow (but filter out of inline data) DOCX without warning,
    // as they are processed separately by processFilesForGemini
    if (f.mimeType.includes('wordprocessingml') || f.mimeType.includes('msword')) {
        return false;
    }

    const isSupported = SUPPORTED_PREFIXES.some(prefix => f.mimeType.startsWith(prefix));
    const isExplicitlyUnsupported = UNSUPPORTED_SUBSTRINGS.some(s => f.mimeType.includes(s));
    
    if (!isSupported || isExplicitlyUnsupported) {
        console.warn(`Filtered out unsupported file type for inline data: ${f.mimeType}`);
        return false;
    }
    return true;
  });
};

// New Helper: Extracts text from DOCX files and separates them from other files
async function processFilesForGemini(files: Array<{ data: string; mimeType: string; name?: string }>) {
    const docxFiles = files.filter(f => f.mimeType.includes('wordprocessingml') || f.mimeType.includes('msword'));
    const otherFiles = files.filter(f => !f.mimeType.includes('wordprocessingml') && !f.mimeType.includes('msword'));
    
    let extractedText = "";
    
    if (docxFiles.length > 0) {
        for (const file of docxFiles) {
            try {
                const buffer = base64ToArrayBuffer(file.data);
                const result = await mammoth.extractRawText({ arrayBuffer: buffer });
                if (result.value) {
                    extractedText += `\n[ATTACHED WORD DOCUMENT CONTENT - ${file.name || 'Untitled'}]:\n${result.value}\n`;
                }
            } catch(e) {
                console.warn(`Failed to parse DOCX ${file.name}`, e);
                extractedText += `\n[SYSTEM ERROR]: Could not extract text from ${file.name || 'Untitled'} (Word Document).`;
            }
        }
    }
    
    const validFiles = filterSupportedFiles(otherFiles as Array<{ data: string; mimeType: string }>);
    
    return { extractedText, validFiles };
}

export const analyzeSubmission = async (
  rubric: string,
  assignmentQuestion: string,
  submissionText: string,
  submissionFiles: Array<{ data: string; mimeType: string; name: string }>,
  youtubeUrl?: string,
  assignmentFiles: Array<{ data: string; mimeType: string; name?: string }> = []
): Promise<AnalysisResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [];

    // Process Files (separates DOCX from others)
    const processedSubmission = await processFilesForGemini(submissionFiles);
    const processedAssignment = await processFilesForGemini(assignmentFiles);

    parts.push({ text: `[ASSIGNMENT QUESTION/PROMPT]:\n${assignmentQuestion || "Refer to attached assignment files if any."}` });
    
    if (processedAssignment.extractedText) {
        parts.push({ text: `[ASSIGNMENT REFERENCE DOCUMENTS (TEXT EXTRACTED)]:\n${processedAssignment.extractedText}` });
    }

    if (processedAssignment.validFiles.length > 0) {
      parts.push({ text: `[ASSIGNMENT REFERENCE FILES]: The following images/PDFs are the assignment papers or reference materials.` });
      processedAssignment.validFiles.forEach(file => {
        parts.push({
          inlineData: {
            data: file.data,
            mimeType: file.mimeType,
          },
        });
      });
    }

    parts.push({ text: `[TEACHER RUBRIC]:\n${rubric}` });

    parts.push({ text: `[STUDENT SUBMISSION START]` });
    
    if (submissionText) {
      parts.push({ text: `[STUDENT TEXT RESPONSE]:\n${submissionText}` });
    }

    if (processedSubmission.extractedText) {
       parts.push({ text: `[STUDENT ATTACHED DOCUMENTS]:${processedSubmission.extractedText}` });
    }

    if (youtubeUrl) {
      parts.push({ 
        text: `[STUDENT YOUTUBE VIDEO LINK]: ${youtubeUrl}
INSTRUCTION:
Analyze the YouTube video content, topic relevance, and educational quality.
Evaluate it strictly against the teacher rubric.
If the video lacks sufficient academic depth, reduce marks accordingly.` 
      });
    }

    if (processedSubmission.validFiles.length > 0) {
        processedSubmission.validFiles.forEach(file => {
        parts.push({
            inlineData: {
            data: file.data,
            mimeType: file.mimeType,
            },
        });
        });
    } else if (submissionFiles.length > 0 && !submissionText && !processedSubmission.extractedText && !youtubeUrl && processedSubmission.validFiles.length === 0) {
         parts.push({ text: `[SYSTEM NOTE]: The user uploaded files but they were in an unsupported format and text extraction failed. Please grade based on available context or ask the user to upload PDF/Image.` });
    }
    
    parts.push({ text: `[STUDENT SUBMISSION END]` });

    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
    };

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: config,
      contents: {
        role: "user",
        parts: parts,
      },
    }));

    if (!response.text) {
      throw new Error("No response from AI");
    }

    let result: AnalysisResponse;
    
    try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        const jsonCandidate = jsonMatch ? jsonMatch[0] : response.text;
        result = JSON.parse(jsonCandidate);
    } catch (parseError) {
        console.warn("JSON Parse Failed. Raw response:", response.text);
        result = {
            summary: "AI could not complete the structured analysis.",
            score: { earned: 0, total: 0, percentage: 0 },
            rubric_breakdown: [],
            critical_gaps: [
              "Analysis Error: The AI returned an unstructured response.", 
              "Raw Response: " + response.text.substring(0, 300) + (response.text.length > 300 ? "..." : "")
            ],
            personalized_recommendation: ["Please check the input content (e.g., broken video link) and try again."],
            sentiment: "Urgent",
            plagiarism_score: 0,
            ai_probability: 0
        };
    }

    return result;

  } catch (error) {
    console.error("Error analyzing submission:", error);
    throw error;
  }
};

export const generateQuizAnalysis = async (
    questions: QuizQuestion[],
    studentAnswers: number[],
    calculatedScore: { earned: number, total: number, percentage: number }
): Promise<AnalysisResponse> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const wrongAnswers = questions.map((q, i) => {
            if (studentAnswers[i] !== q.correctAnswer) {
                return `Question: ${q.question}\nCorrect Answer: ${q.options[q.correctAnswer]}\nStudent Answer: ${studentAnswers[i] !== undefined ? q.options[studentAnswers[i]] : 'No Answer'}`;
            }
            return null;
        }).filter(Boolean);

        const parts: any[] = [];
        parts.push({ text: `
            Analyze this quiz performance.
            Score: ${calculatedScore.earned}/${calculatedScore.total} (${calculatedScore.percentage}%)
            
            Missed Questions & Topics:
            ${wrongAnswers.join('\n\n')}
            
            Task:
            1. Provide a Summary of performance.
            2. Generate "Personalized Recommendations" based on the specific topics of the missed questions.
            3. Sentiment should reflect the score.
            4. Plagiarism/AI Probability is N/A for quizzes, set to 0.
            5. Rubric Breakdown should list "Quiz Accuracy" as the main criterion.
        `});

        const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: "You are an AI tutor analyzing quiz results. Provide study tips based on incorrect answers.",
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
            },
            contents: { role: "user", parts }
        }));

        if (response.text) {
            return JSON.parse(response.text);
        }
        throw new Error("Failed to generate quiz analysis");
    } catch (e) {
        console.error("Quiz Analysis Error", e);
        return {
            summary: "Quiz graded automatically.",
            score: calculatedScore,
            rubric_breakdown: [{ criterion: "Quiz Accuracy", score: calculatedScore.earned, feedback: "Automated scoring based on selected options."}],
            critical_gaps: ["Check incorrect answers."],
            personalized_recommendation: ["Review the material for missed questions."],
            sentiment: calculatedScore.percentage > 50 ? 'Constructive' : 'Urgent',
            plagiarism_score: 0,
            ai_probability: 0
        };
    }
};

export const generateRubric = async (topic: string, level: string = "SPM (Malaysian High School)"): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `You are an expert curriculum developer for the Malaysian education system.
    Your task is to generate structured grading rubrics for specific topics and levels.
    
    OUTPUT FORMAT:
    - Return a clean, plain text list.
    - Format: "- Criterion Name (Max Points): Description of what is required."
    - Ensure the total points sum to 100 if possible, or a logical total.`,
      },
      contents: {
        role: "user",
        parts: [{ text: `Generate a structured grading rubric for:\nTopic: "${topic}"\nTarget Level: ${level}` }]
      },
    }));

    return response.text || "Failed to generate rubric.";
  } catch (error) {
    console.error("Error generating rubric:", error);
    return "Error generating rubric. Please try again.";
  }
};

// --- CONTENT GENERATION SCHEMAS ---

const presentationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    overview: { type: Type.STRING },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.NUMBER },
          title: { type: Type.STRING },
          contentPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          speakerNotes: { type: Type.STRING },
          visualCue: { type: Type.STRING }
        },
        required: ["slideNumber", "title", "contentPoints"]
      }
    }
  },
  required: ["title", "slides"]
};

const examSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    instructions: { type: Type.STRING },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sectionTitle: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.STRING },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                marks: { type: Type.STRING }
              },
              required: ["number", "text", "marks"]
            }
          }
        },
        required: ["sectionTitle", "questions"]
      }
    },
    answerKey: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionNumber: { type: Type.STRING },
          answer: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["questionNumber", "answer"]
      }
    }
  },
  required: ["title", "instructions", "sections", "answerKey"]
};

const assignmentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    overview: { type: Type.STRING },
    objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
    instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
    submissionGuidelines: { type: Type.STRING },
    gradingCriteria: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["title", "overview", "objectives", "instructions"]
};

const classroomQuizSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Exactly 4 options for multiple choice." 
          },
          correctAnswer: { 
            type: Type.NUMBER, 
            description: "The index (0, 1, 2, or 3) of the correct option." 
          }
        },
        required: ["question", "options", "correctAnswer"]
      }
    }
  },
  required: ["questions"]
};

export const generateEducationalContent = async (
  type: 'Quiz' | 'Exam' | 'Assignment' | 'Presentation',
  topic: string,
  requirements: string,
  referenceFiles: Array<{ data: string; mimeType: string }> = []
): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let schema = assignmentSchema;
    let systemInstruction = "You are an expert educational content generator for NextHorizon. Return strictly clean JSON. Do NOT use markdown symbols like **, ## or * in the text content. ALWAYS GENERATE CONTENT IN ENGLISH unless the user explicitly asks for another language in the requirements.";

    if (type === 'Presentation') {
      schema = presentationSchema;
      systemInstruction += ` For Presentations, generate structured slide content suitable for a standard 16:9 PowerPoint deck. Max 4 bullet points per slide.`;
    } else if (type === 'Exam' || type === 'Quiz') {
      schema = examSchema;
      systemInstruction += " For Exams/Quizzes, separate the Question Paper from the Answer Key completely.";
    }

    const parts: any[] = [];
    const validReferenceFiles = filterSupportedFiles(referenceFiles);

    parts.push({ text: `
      Create a ${type} for the topic: "${topic}".
      Additional Requirements/Context: ${requirements}.
      Context: Malaysian Education System (English Medium).
      Language: English (Strictly generate in English unless requested otherwise).
    `});

    if (validReferenceFiles.length > 0) {
      parts.push({ text: `[REFERENCE MATERIALS]: Use the following attached documents, images, or audio files as source material for the questions or content.` });
      validReferenceFiles.forEach(file => {
        parts.push({
           inlineData: {
             data: file.data,
             mimeType: file.mimeType
           }
        });
      });
    }

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash", 
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: systemInstruction,
      },
      contents: {
        role: "user",
        parts: parts
      },
    }));

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error generating content:", error);
    return null;
  }
};

export const generateStudyMaterial = async (
  title: string,
  content: string,
  files: Array<{ data: string; mimeType: string }> = []
) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [];
    const validFiles = filterSupportedFiles(files);

    parts.push({ text: `Generate a study aid (Summary and Flashcards) for the following educational material.\n\nTitle: ${title}\nContent Description: ${content}` });

    if (validFiles.length > 0) {
      parts.push({ text: `[REFERENCE FILES]: Use the attached files to extract key concepts.` });
      validFiles.forEach(file => {
        parts.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
      });
    }

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: studyAidSchema,
        systemInstruction: "You are an AI Study Companion. Create a concise summary and a set of flashcards for active recall revision.",
      },
      contents: { role: "user", parts },
    }));

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error generating study aid:", error);
    return null;
  }
};

export const generateClassroomQuiz = async (
  title: string,
  instructions: string,
  files: Array<{ data: string; mimeType: string }> = []
): Promise<QuizQuestion[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [];
    const validFiles = filterSupportedFiles(files);

    parts.push({ text: `Generate a multiple-choice quiz based on the provided context. Topic: ${title}. Instructions: ${instructions}. Generate 5-10 questions.` });

    if (validFiles.length > 0) {
        parts.push({ text: "[REFERENCE MATERIALS]: Use these files to generate relevant questions:" });
        validFiles.forEach(f => {
            parts.push({ inlineData: { data: f.data, mimeType: f.mimeType } });
        });
    }

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: classroomQuizSchema,
        systemInstruction: "You are an automated quiz generator for teachers. Create accurate, educational questions matching the schema provided.",
      },
      contents: { role: "user", parts: parts },
    }));

    if (response.text) {
        const data = JSON.parse(response.text);
        if (data.questions && Array.isArray(data.questions)) {
            return data.questions.map((q: any, i: number) => ({
                id: Date.now().toString() + i,
                question: q.question,
                options: q.options,
                correctAnswer: q.correctAnswer,
                points: 10 
            }));
        }
    }
    return [];
  } catch (e) {
    console.error("Quiz Gen Error", e);
    return [];
  }
};

export const generateImage = async (
  prompt: string,
  resolution: '1K' | '2K' | '4K' = '1K'
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = (resolution === '2K' || resolution === '4K') 
      ? 'gemini-3.1-flash-image-preview' 
      : 'gemini-2.5-flash-image';

    const config: any = {
      imageConfig: { aspectRatio: "1:1" }
    };
    if (model === 'gemini-3.1-flash-image-preview') config.imageConfig.imageSize = resolution;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: config
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated.");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

export const generateAttendanceSummary = async (
  date: string,
  className: string,
  presentCount: number,
  absentCount: number,
  absentStudents: string[]
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
         systemInstruction: "You are a school administrator assistant. Provide concise, data-driven summaries of daily attendance.",
      },
      contents: {
        role: "user",
        parts: [{ text: `Date: ${date}\nClass: ${className}\nPresent: ${presentCount}\nAbsent: ${absentCount}\nAbsent Students: ${absentStudents.join(', ')}\n\nAnalyze this attendance data. Provide a brief, professional summary (max 3 sentences).` }]
      },
    }));
    return response.text || "Summary unavailable.";
  } catch (error) {
    console.error("Attendance Summary Error:", error);
    return "Error generating summary.";
  }
};
