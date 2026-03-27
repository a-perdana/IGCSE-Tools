/**
 * Shared Cambridge IGCSE constants and prompt fragments.
 * Imported by gemini.ts, openai-provider.ts, and anthropic-provider.ts.
 */

export const IGCSE_SUBJECTS = [
  "Mathematics",
  "Biology",
  "Physics",
  "Chemistry",
];

export const IGCSE_TOPICS: Record<string, string[]> = {
  Mathematics: [
    "Number",
    "Algebra",
    "Functions",
    "Geometry",
    "Trigonometry",
    "Vectors & Transformations",
    "Mensuration",
    "Coordinate Geometry",
    "Statistics",
    "Probability",
    "Mixed Topics",
  ],
  Biology: [
    "Characteristics of Living Organisms",
    "Cell Structure",
    "Biological Molecules",
    "Enzymes",
    "Plant Nutrition",
    "Human Nutrition",
    "Transport in Plants",
    "Transport in Animals",
    "Diseases & Immunity",
    "Gas Exchange",
    "Respiration",
    "Excretion",
    "Coordination & Response",
    "Drugs",
    "Reproduction",
    "Inheritance",
    "Variation & Selection",
    "Organisms & Environment",
    "Biotechnology",
    "Mixed Topics",
  ],
  Physics: [
    "Motion, Forces & Energy",
    "Thermal Physics",
    "Waves",
    "Electricity & Magnetism",
    "Nuclear Physics",
    "Space Physics",
    "Mixed Topics",
  ],
  Chemistry: [
    "States of Matter",
    "Atoms, Elements & Compounds",
    "Stoichiometry",
    "Electrochemistry",
    "Chemical Energetics",
    "Chemical Reactions",
    "Acids, Bases & Salts",
    "The Periodic Table",
    "Metals",
    "Chemistry of the Environment",
    "Organic Chemistry",
    "Experimental Techniques",
    "Mixed Topics",
  ],
};

export const DIFFICULTY_LEVELS = ["Easy", "Medium", "Challenging", "Balanced"];

export const DIFFICULTY_GUIDANCE: Record<string, string> = {
  Easy: `DIFFICULTY: Easy
- Target: 80–90% of students should answer correctly
- Bloom's Level: L1 Remember / L2 Understand
- Marks per question: 1–2
- Command words: State, Name, Define, List, Identify, Label
- Style: Single concept, direct recall, familiar textbook contexts, one-step calculations
- MCQ distractors: clearly wrong to a student who knows the topic
- AO distribution: ~70% AO1 (recall/knowledge), ~30% AO2 (simple application), no AO3`,

  Medium: `DIFFICULTY: Medium
- Target: 40–60% of students should answer correctly
- Bloom's Level: L3 Apply / L4 Analyse
- Marks per question: 2–4
- Command words: Describe, Explain, Calculate, Show, Draw
- Style: Apply knowledge to given scenarios, combine 2 concepts, 2–3 step calculations
- MCQ distractors: plausible but distinguishable with careful reasoning
- AO distribution: ~20% AO1, ~60% AO2 (application/calculation), ~20% AO3 (experimental)`,

  Challenging: `DIFFICULTY: Challenging — STRICTLY ENFORCE the following:
- Target: Only 10–20% of students should answer fully correctly (A* discriminator questions)
- Bloom's Level: L4 Analyse / L5 Evaluate / L6 Create
- Marks per question: 4–8 (multi-part questions encouraged)
- Command words: Evaluate, Discuss, Suggest, Compare, Deduce, Predict — NOT "State" or "Name"
- AO distribution: ≤10% AO1, ~60% AO2 (complex analysis/synthesis), ~30% AO3 (experimental design/evaluation)
- MANDATORY requirements for EVERY question:
  1. Place knowledge in UNFAMILIAR contexts (novel scenarios, not textbook examples)
  2. Require chaining 3+ concepts or calculation steps — no single-step answers
  3. Where possible, synthesise across two syllabus topics (e.g. stoichiometry + energetics)
  4. Extended response questions (≥4 marks) must demand a structured argument with evidence
  5. Calculations must require rearranging formulae and multi-stage working
  6. MCQ: all four options must be plausible misconceptions; correct answer requires rigorous reasoning
  7. Mark scheme must have 4+ distinct marking points
- A question that a student can answer from memory alone is NOT acceptable for this difficulty`,

  Balanced: `DIFFICULTY: Balanced — distribute across: Easy ~25% (80–90% pass rate), Medium ~50% (40–60% pass rate), Challenging ~25% (10–20% pass rate).
Include a variety of command words and mark ranges (1–6 marks).
AO distribution (strictly enforce): ~30% AO1 (recall/knowledge), ~50% AO2 (application/analysis/calculation), ~20% AO3 (experimental/evaluation).
For a set of 4 questions: at least 1 AO1, 2 AO2, 1 AO3. Scale proportionally for larger sets.`,
};

export const CAMBRIDGE_COMMAND_WORDS: Record<string, string> = {
  State: "Express in clear terms.",
  Name: "Identify using a recognised technical term.",
  List: "Give a number of points with no explanation.",
  Define: "Give the meaning of a term precisely.",
  Label: "Add names or identifiers to a diagram.",
  Identify: "Name or otherwise characterise.",
  Describe:
    "State the points of a topic / give characteristics and main features.",
  Explain:
    "Set out purposes or reasons / make the relationships between things evident / provide why and/or how and support with relevant evidence.",
  Suggest:
    "Apply knowledge and understanding to situations where there are a range of valid responses in order to make proposals / put forward considerations.",
  Evaluate:
    "Judge or calculate the quality, importance, amount, or value of something.",
  Discuss: "Write about issue(s) or topic(s) in depth in a structured way.",
  Compare: "Identify/comment on similarities and/or differences.",
  Calculate: "Work out from given facts, figures or information.",
  Show: "Provide structured evidence that leads to a given result.",
  Deduce: "Reach a conclusion from the information given.",
  Predict: "Give an expected result.",
  Draw: "Produce a diagram.",
  Sketch: "Make a simple freehand drawing showing key features.",
  Determine: "Establish with certainty from information given.",
  Outline: "Set out the main points.",
  Justify: "Support a case with evidence/reasoning.",
  Plot: "Mark on a graph using data provided.",
};

/** Cambridge IGCSE Assessment Objectives — used to tag questions */
export const ASSESSMENT_OBJECTIVES: Record<string, string> = {
  AO1: "Knowledge and understanding — recall, name, state, define, describe facts and concepts.",
  AO2: "Handling information and problem solving — apply knowledge, analyse, interpret data, calculate, deduce, predict.",
  AO3: "Experimental skills and investigations — plan, observe, measure, record, evaluate experimental procedures.",
};

/** Subject-specific rules that must be applied when generating questions */
export const SUBJECT_SPECIFIC_RULES: Record<string, string> = {
  Chemistry: `CHEMISTRY-SPECIFIC RULES (strictly enforce):
- Chemical equations must be balanced; include state symbols (s), (l), (g), (aq) in all equations.
- Use IUPAC nomenclature for compound names.
- Half-equations for electrolysis must show correct electrons: e.g. Cu²⁺ + 2e⁻ → Cu.
- Thermochemistry questions must specify units (kJ mol⁻¹) and sign conventions (exothermic = negative ΔH).
- Organic chemistry: use displayed/structural formulae instructions precisely; specify chain length.
- Precipitation reactions: write ionic equations, not just word equations.
- Titration/stoichiometry calculations: mark scheme must use M1 (mole ratio / method) + A1 (correct answer with unit).`,

  Physics: `PHYSICS-SPECIFIC RULES (strictly enforce):
- ALL numerical answers must include SI units. Penalise missing units explicitly in mark scheme.
- Equations must be stated before substitution (this scores a B1 mark in mark scheme).
- Mark scheme for calculations: B1 correct equation, M1 correct substitution, A1 correct answer with unit.
- Use standard notation: m s⁻¹ (not m/s), kg m⁻³ (not kg/m³), N m⁻² or Pa.
- For circuits: distinguish clearly between series and parallel; label EMF vs terminal p.d.
- Graphs: axes must be labelled with quantity and unit (e.g. "Force / N").
- Vectors vs scalars: define direction for vector quantities.
- Wave calculations: state formula (v = fλ) before substituting values.`,

  Biology: `BIOLOGY-SPECIFIC RULES (strictly enforce):
- Use precise biological terminology: "partially permeable membrane" not "semi-permeable"; "mitosis" not "cell division".
- Photosynthesis/respiration equations must use correct reactants and products.
- Genetics: use Punnett squares where required; clearly define allele notation (capital = dominant).
- Mark scheme must credit specific named structures (e.g. "villus" not just "small intestine lining").
- For experimental questions: always include a control variable and state what it controls for.
- Evolution questions: reference natural selection mechanism (variation → selection pressure → survival → reproduction → inheritance).
- For calculations (e.g. magnification, percentage change): use M1/A1 mark notation.`,

  Mathematics: `MATHEMATICS-SPECIFIC RULES (strictly enforce):
- All algebraic expressions must use correct LaTeX: $3x^2 - 5x + 2 = 0$, not plain text.
- Mark scheme for ALL calculation questions MUST use M1/A1/B1 Cambridge notation:
  • B1: correct formula or expression stated (e.g. "B1: $v^2 = u^2 + 2as$")
  • M1: correct substitution / method step (e.g. "M1: substitutes $u=0$, $a=9.8$, $s=5$")
  • A1: correct final answer with units (e.g. "A1: $v = 9.9$ m s⁻¹ (3 s.f.)")
  • If a student uses a correct method but makes an arithmetic slip, they still earn M1 (not A1).
- "Show that" questions: mark scheme must show full working chain; final line must match the given answer.
- Geometry: state theorem names in mark scheme (e.g. "B1: angle in semicircle = 90°").
- Statistics: if using calculator — accept equivalent exact fractions or rounded decimals (specify 3 s.f. or 2 d.p.).
- Probability: answers must be as fractions, decimals, or percentages — penalise "ratio" form in mark scheme.
- Constructions: specify tolerance (e.g. ±2mm, ±2°).`,
};

/** Cambridge mark scheme formatting rules — applied to ALL subjects */
export const MARK_SCHEME_FORMAT = `MARK SCHEME FORMAT RULES (strictly enforce for every question):
1. List each marking point on its own numbered line: "1. [point]", "2. [point]", etc.
2. Mark types — use Cambridge M/A/B notation for ALL calculation questions (Maths, Physics, Chemistry):
   - M1: Method mark — correct approach/formula/substitution, awarded even if arithmetic slip follows.
     Format: "M1: [description of method, e.g. 'substitutes correctly into v = u + at']"
   - A1: Accuracy mark — correct numerical answer following a correct method. Always paired with preceding M1.
     Format: "A1: [value with unit, e.g. '12.5 m s⁻¹']"
   - B1: Independent mark — not dependent on method (e.g. correct formula stated alone, correct graph reading, correct unit).
     Format: "B1: [point]"
   - FT: Follow-through — if a previous wrong answer is carried forward correctly, award FT mark.
   For knowledge/descriptive questions: use plain numbered "1. [point]" format (1 mark each).
3. Accepted alternatives: write "Accept: [alternative]" on the same line or line after the point.
4. Rejected responses: write "Reject: [wrong answer / common misconception]" if relevant.
5. For multi-step calculations: each step is a separate M1 or A1 line showing full working.
6. For extended writing (≥3 marks, descriptive/explain/evaluate): use a LEVEL descriptor approach:
   - Level 3 (3 marks): Clear, detailed, well-structured response with all key points.
   - Level 2 (2 marks): Mostly correct with some detail missing.
   - Level 1 (1 mark): Basic response, limited scientific language, key points missing.
   Then list the "indicative content" — the ideas that earn credit.
7. Do NOT write mark scheme as a paragraph. Use M1/A1/B1 or numbered bullets only.
8. Final answer line must state the correct value with SI unit (for calculations).`;

export const PAST_PAPER_FOCUS: Record<string, string> = {
  Easy: `Focus EXCLUSIVELY on the easiest questions in these papers: opening questions, part (a) sub-parts, 1–2 mark items, and any question using "State", "Name", or "Define". Ignore all other questions.`,
  Medium: `Focus on the mid-section questions in these papers: 2–4 mark items, "Describe" and "Explain" questions, and calculation questions with 2–3 steps. Ignore both the very easy opening questions and the hardest final questions.`,
  Challenging: `Focus EXCLUSIVELY on the HARDEST questions in these papers: the final questions of each section, all questions worth 4+ marks, any "Evaluate", "Discuss", or extended writing question, and multi-part structured questions. These are the questions that differentiate A* from A students. Replicate ONLY this level of difficulty — completely ignore the easier questions in the papers.`,
  Balanced: `Use the full range of questions across the papers to represent all difficulty levels proportionally.`,
};

export const SUBJECT_CODES: Record<string, string> = {
  Mathematics: "MAT",
  Biology: "BIO",
  Physics: "PHY",
  Chemistry: "CHM",
};

export const DIFFICULTY_CODES: Record<string, string> = {
  Easy: "EAS",
  Medium: "MED",
  Challenging: "CHL",
  Balanced: "BAL",
};
