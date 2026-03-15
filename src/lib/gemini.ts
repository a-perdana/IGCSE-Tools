import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const IGCSE_SUBJECTS = ["Mathematics", "Biology", "Physics", "Chemistry"];

export const IGCSE_TOPICS: Record<string, string[]> = {
  "Mathematics": [
    "Number", "Algebra", "Functions", "Geometry", "Trigonometry", 
    "Vectors & Transformations", "Mensuration", "Coordinate Geometry", 
    "Statistics", "Probability", "Mixed Topics"
  ],
  "Biology": [
    "Characteristics of Living Organisms", "Cell Structure", "Biological Molecules",
    "Enzymes", "Plant Nutrition", "Human Nutrition", "Transport in Plants",
    "Transport in Animals", "Diseases & Immunity", "Gas Exchange", "Respiration",
    "Excretion", "Coordination & Response", "Drugs", "Reproduction", "Inheritance",
    "Variation & Selection", "Organisms & Environment", "Biotechnology", "Mixed Topics"
  ],
  "Physics": [
    "Motion, Forces & Energy", "Thermal Physics", "Waves", 
    "Electricity & Magnetism", "Nuclear Physics", "Space Physics", "Mixed Topics"
  ],
  "Chemistry": [
    "States of Matter", "Atoms, Elements & Compounds", "Stoichiometry",
    "Electrochemistry", "Chemical Energetics", "Chemical Reactions",
    "Acids, Bases & Salts", "The Periodic Table", "Metals",
    "Chemistry of the Environment", "Organic Chemistry", "Experimental Techniques", "Mixed Topics"
  ]
};

export const DIFFICULTY_LEVELS = ["Easy", "Medium", "Challenging", "Balanced"];

export const CAMBRIDGE_COMMAND_WORDS = {
  "Describe": "State the points of a topic / give characteristics and main features.",
  "Explain": "Set out purposes or reasons / make the relationships between things evident / provide why and/or how and support with relevant evidence.",
  "Suggest": "Apply knowledge and understanding to situations where there are a range of valid responses in order to make proposals / put forward considerations.",
  "Evaluate": "Judge or calculate the quality, importance, amount, or value of something.",
  "Discuss": "Write about issue(s) or topic(s) in depth in a structured way.",
  "Compare": "Identify/comment on similarities and/or differences.",
  "State": "Express in clear terms.",
  "Calculate": "Work out from given facts, figures or information."
};

export interface TestRequest {
  subject: string;
  topic: string;
  difficulty: string;
  count: number;
  type: string;
  calculator: boolean;
  model: string;
  syllabusContext?: string;
  references?: { data: string; mimeType: string }[];
}

export interface TestResponse {
  questions: string;
  answerKey: string;
  markScheme: string;
}

export async function generateTest(config: TestRequest): Promise<TestResponse> {
  const prompt = `Generate a Cambridge IGCSE ${config.subject} test based on these requirements:
Topic: ${config.topic}
Difficulty: ${config.difficulty}
Number of Questions: ${config.count}
Question Type: ${config.type}
Calculator: ${config.calculator ? "Allowed" : "Not Allowed"}
${config.syllabusContext ? `Syllabus Context/Objectives: ${config.syllabusContext}` : ""}

Follow these rules strictly:
1. You MUST generate EXACTLY ${config.count} questions. Do not generate more or less.
2. All questions must follow Cambridge IGCSE ${config.subject} standards, style, and difficulty level.
2. For Science subjects (Biology, Physics, Chemistry), ensure questions cover experimental skills and theoretical knowledge.
3. **DIAGRAMS**: When a diagram is needed (especially for Biology cells, organs, or Physics circuits), provide the diagram as an **inline SVG code block** (using \`\`\`svg ... \`\`\`) within the markdown. 
    - **CRITICAL**: Use **camelCase** for all SVG attributes (e.g., use \`strokeWidth\` instead of \`stroke-width\`, \`fontSize\` instead of \`font-size\`, \`fontFamily\` instead of \`font-family\`).
    - Ensure the SVG is clean, labeled with letters (A, B, C, etc.) as per IGCSE style, and fits well within a document.
4. Format the output as a JSON object with three fields: "questions", "answerKey", and "markScheme".
5. Use LaTeX for mathematical notation and chemical formulas (e.g., $H_2O$, $x^2$, $\Delta H$).
6. "questions" should be a markdown string for SECTION 1.
7. "answerKey" should be a markdown string for SECTION 2. **DO NOT LEAVE THIS EMPTY.**
8. "markScheme" should be a markdown string for SECTION 3 (step-by-step with marks allocation). **DO NOT LEAVE THIS EMPTY.**
9. Do not include any text outside the JSON object.
10. If reference documents (Syllabus or Past Papers) are provided, use them as the primary source for style, depth, and specific learning objectives.
11. **FORMATTING**: 
    - The main question text must be **bold**.
    - Each answer option (A, B, C, D) must be on a new line. **CRITICAL**: Use double newlines between the question and options, and between each option, to ensure they are rendered as separate lines in Markdown.
    - The "Syllabus Reference:" label and its code must be **bold** and on a new line at the end of the question (use double newlines before it).`;

  const parts: any[] = [];
  
  if (config.references && config.references.length > 0) {
    config.references.forEach(ref => {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType,
          data: ref.data.split(",")[1] || ref.data,
        },
      });
    });
  }
  
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: config.model || "gemini-3-flash-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: { type: Type.STRING },
          answerKey: { type: Type.STRING },
          markScheme: { type: Type.STRING },
        },
        required: ["questions", "answerKey", "markScheme"],
      },
      systemInstruction: `You are an expert Cambridge IGCSE Assessment Designer for ${config.subject}. 
Your goal is to create high-quality, syllabus-aligned assessments. 
You MUST provide the questions, the answer key, and a detailed mark scheme.

**Cambridge Command Words Usage**:
- **Describe**: State the points of a topic / give characteristics and main features.
- **Explain**: Set out purposes or reasons / make the relationships between things evident / provide why and/or how and support with relevant evidence.
- **Suggest**: Apply knowledge and understanding to situations where there are a range of valid responses in order to make proposals / put forward considerations.
- **Evaluate**: Judge or calculate the quality, importance, amount, or value of something.
- **Calculate**: Work out from given facts, figures or information.

When generating SVG diagrams:
- Use a clean, professional "exam paper" style (black lines on white/transparent background).
- Ensure all labels (A, B, C, etc.) are clearly placed with leader lines if necessary.
- Use a consistent font (Arial/Helvetica) for text within SVGs.
- **CRITICAL**: Use **camelCase** for all SVG attributes (e.g., \`strokeWidth\`, \`fontSize\`, \`fontFamily\`, \`textAnchor\`, \`dominantBaseline\`).
- Keep the SVG responsive and centered.
- For Science, ensure diagrams are technically accurate (e.g., correct circuit symbols, accurate cell organelles).
- **Formatting**: 
    - Make the question text **bold**.
    - Always put each answer option (A, B, C, D) on its own line. **IMPORTANT**: Use double newlines between each option to prevent them from merging into one line.
    - Place **Syllabus Reference:** on a new line at the bottom (using double newlines) and make it **bold**.`,
    },
  });

  return safeJsonParse(response.text || "{}");
}

export async function auditTest(subject: string, test: TestResponse, model: string = "gemini-3.1-pro-preview"): Promise<TestResponse> {
  const prompt = `You are a Senior Cambridge IGCSE Examiner and Auditor for ${subject}. 
Your task is to review the following assessment and ensure it meets the highest standards of accuracy, pedagogical precision, and formatting.

ASSESSMENT TO REVIEW:
---
QUESTIONS:
${test.questions}

ANSWER KEY:
${test.answerKey}

MARK SCHEME:
${test.markScheme}
---

AUDIT CRITERIA:
1. **Command Words**: Ensure words like "Describe", "Explain", "Suggest" are used correctly according to IGCSE definitions.
2. **Mark Allocation**: Ensure the mark scheme points match the cognitive demand of the question (e.g., a 4-mark "Explain" question must have 4 clear marking points).
3. **Accuracy**: Check for any scientific or mathematical errors.
4. **Formatting**: Ensure bold question text, double newlines for options, and bold Syllabus References.
5. **SVG Diagrams**: Ensure SVG diagrams are technically correct and use camelCase attributes.

If you find errors, fix them and return the ENTIRE corrected assessment in the same JSON format.
If the assessment is perfect, return it as is.

Format the output as a JSON object with three fields: "questions", "answerKey", and "markScheme".`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: { type: Type.STRING },
          answerKey: { type: Type.STRING },
          markScheme: { type: Type.STRING },
        },
        required: ["questions", "answerKey", "markScheme"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function getStudentFeedback(
  subject: string,
  test: TestResponse,
  studentAnswers: string,
  modelName: string = "gemini-3-flash-preview"
): Promise<string> {
  const prompt = `
    You are an expert Cambridge IGCSE Examiner for ${subject}.
    
    TASK:
    Evaluate the student's answers based on the provided questions and mark scheme.
    
    QUESTIONS:
    ${test.questions}
    
    MARK SCHEME:
    ${test.markScheme}
    
    STUDENT ANSWERS:
    ${studentAnswers}
    
    INSTRUCTIONS:
    1. Be strict but fair, following the Cambridge assessment objectives.
    2. For each question, indicate if it's correct, partially correct, or incorrect.
    3. Provide specific feedback on how to improve, referencing the "Command Words" if applicable.
    4. Give an estimated mark for each section.
    5. Summarize the student's performance and provide 3 key areas for improvement.
    6. Use Markdown for formatting.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: "You are a professional Cambridge IGCSE examiner. Provide constructive, precise feedback based on official mark schemes.",
    },
  });

  return response.text || "Could not generate feedback.";
}

function safeJsonParse(text: string) {
  if (!text) return {};
  
  let cleaned = text.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Attempt to find the first '{' and last '}'
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.substring(start, end + 1));
      } catch (e2) {
        // If it's still failing, it might be an escaping issue or truncation
        // We'll throw the original error but with more context
        console.error("JSON Parse Error Context:", cleaned.substring(Math.max(0, cleaned.length - 500)));
        throw e;
      }
    }
    throw e;
  }
}

export async function analyzeFile(
  base64Data: string, 
  mimeType: string, 
  subject: string,
  count: number = 3,
  model: string = "gemini-3-flash-preview",
  references?: { data: string; mimeType: string }[]
): Promise<{ analysis: string; similarQuestions: string; answerKey: string; markScheme: string }> {
  const isPdf = mimeType === "application/pdf";
  const prompt = `Analyze this ${isPdf ? "past paper PDF" : "screenshot"} of a Cambridge IGCSE ${subject} question.
1. Explain the topic and learning objectives it covers.
2. Generate EXACTLY ${count} similar questions with the same concept but different context. Do not generate more or less.
3. For Science subjects, include SVG diagrams if appropriate for the similar questions. Use \`\`\`svg ... \`\`\` code blocks and **camelCase** attributes.
4. If Syllabus reference documents are provided, ensure the analysis and new questions align strictly with the syllabus learning objectives.
5. **FORMATTING**: 
    - The question text must be **bold**.
    - Each answer option (A, B, C, D) must be on a new line. **IMPORTANT**: Use double newlines between each option to ensure they render correctly on separate lines.
    - Place **Syllabus Reference:** on a new line at the bottom (using double newlines) and make it **bold**.
Format the output as a JSON object with four fields: 
- "analysis" (markdown string explaining topic and objectives)
- "similarQuestions" (markdown string for the new questions)
- "answerKey" (markdown string for the answers to the new questions). **DO NOT LEAVE THIS EMPTY.**
- "markScheme" (markdown string for the step-by-step mark scheme for the new questions). **DO NOT LEAVE THIS EMPTY.**`;

  const parts: any[] = [];
  
  if (references && references.length > 0) {
    references.forEach(ref => {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType,
          data: ref.data.split(",")[1] || ref.data,
        },
      });
    });
  }

  parts.push({
    inlineData: {
      mimeType: mimeType,
      data: base64Data.split(",")[1] || base64Data,
    },
  });
  
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: model,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192, // Increased to handle large SVG-heavy responses
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysis: { type: Type.STRING },
          similarQuestions: { type: Type.STRING },
          answerKey: { type: Type.STRING },
          markScheme: { type: Type.STRING },
        },
        required: ["analysis", "similarQuestions", "answerKey", "markScheme"],
      },
      systemInstruction: `You are an expert Cambridge IGCSE ${subject} assessment designer. 
Analyze past paper questions with high precision and generate similar questions that maintain the exact same cognitive demand and style. 
Use SVG for any diagrams in the similar questions to ensure they look like official exam papers. Use **camelCase** for SVG attributes.
**Formatting**: 
    - Question text must be **bold**.
    - Each answer option (A, B, C, D) must be on a new line. **IMPORTANT**: Use double newlines between each option.
    - Place **Syllabus Reference:** on a new line at the bottom (using double newlines) and make it **bold**.
You MUST provide the analysis, similar questions, answer key, and mark scheme.`,
    },
  });

  return safeJsonParse(response.text || "{}");
}
