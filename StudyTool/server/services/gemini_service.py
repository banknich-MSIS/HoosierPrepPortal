"""
Gemini API integration service for AI-powered exam generation.
Handles API configuration, prompt building, and response parsing.
"""
import json
import re
import time
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions


class ExamConfig(BaseModel):
    """Configuration for exam generation."""
    question_count: int
    difficulty: str
    question_types: List[str]
    focus_concepts: Optional[List[str]] = None
    generation_mode: str = "strict"  # strict | mixed | creative


class QuestionData(BaseModel):
    """Structure for a single question."""
    question: str
    answer: Union[str, List[str]]  # Accept both string and array from Gemini
    type: str
    options: Optional[List[str]] = None
    concepts: List[str] = []
    explanation: Optional[str] = None


class ExamMetadata(BaseModel):
    """Metadata about the generated exam."""
    topic: str
    themes: List[str]
    difficulty: str
    estimated_time_minutes: int


class GeneratedExam(BaseModel):
    """Complete exam structure from Gemini."""
    metadata: ExamMetadata
    questions: List[QuestionData]


# Prompt template for exam generation
EXAM_GENERATION_PROMPT = """
You are an AI exam generator that transforms study materials into structured question sets.
Your purpose is to process academic materials and produce well-formatted questions suitable for practice exams.

Study Material:
{content}

Requirements:
- Generate exactly {question_count} questions
- Difficulty level: {difficulty}
- Question types to include: {question_types}
{focus_concepts_section}

QUESTION TYPE DEFINITIONS:
- mcq: Multiple choice with exactly ONE correct answer (provide 4 options)
- multi: Multiple choice where user selects ALL correct answers (can be 1 or more, provide 4+ options)
- short: Short text answer (single word or phrase)
- truefalse: True or False question
- cloze: Fill-in-the-blank question with one or more blanks

QUESTION DIFFICULTY GUIDELINES:
- Easy: Focus on definitions, basic concepts, direct recall. Use straightforward language and obvious distractors.
- Medium: Require application of concepts, comparison, analysis. Use scenarios and require understanding beyond memorization.
- Hard: Multi-step reasoning, edge cases, synthesis of multiple concepts. Use subtle distractors and complex scenarios.

IMPORTANT RULES:
1. For MCQ questions, provide exactly 4 options with the correct answer as ONE of them
2. For MCQ, wrong options must be plausible (common misconceptions, similar concepts, not obviously wrong)
3. Avoid obviously incorrect distractors (unrelated terms, nonsensical combinations, wrong units)
4. For multi-select, provide 4+ options where 1 or more are correct
5. For short answer, truefalse, and cloze questions, set options to null or empty array
6. Each question should have 1-3 relevant concept tags
7. Ensure high quality questions that test real understanding
8. Distribute questions evenly across selected {question_types} types
9. Vary difficulty within the {difficulty} level
10. DO NOT include citation markers, references, or metadata in questions
11. Questions should be clean text without [cite:XX] or similar annotations

CRITICAL: Return ONLY valid JSON in this exact format (no markdown code blocks, just pure JSON):
{{
  "metadata": {{
    "topic": "main topic extracted from material",
    "themes": ["theme1", "theme2", "theme3"],
    "difficulty": "{difficulty}",
    "estimated_time_minutes": <number based on question count and types>
  }},
  "questions": [
    {{
      "question": "clear, specific question text",
      "answer": "correct answer",
      "type": "mcq|multi|short|truefalse|cloze",
      "options": ["option1", "option2", "option3", "option4"],
      "concepts": ["concept1", "concept2"],
      "explanation": "brief explanation of correct answer"
    }}
  ]
}}

IMPORTANT: You MUST complete the entire exam generation. Generate ALL {{question_count}} questions requested.
Do not stop early. Ensure the JSON is complete and valid with proper closing braces.

ANSWER FIELD FORMATTING:
- mcq: Single answer matching one option exactly (e.g., "Option text")
- multi: Array with all correct options (e.g., ["Option A", "Option C"])
- short: Simple text (e.g., "mitochondria")
- truefalse: "True" or "False"
- cloze: Array with answers for each blank in order (e.g., ["answer1", "answer2"])

QUALITY CHECKLIST:
✓ Questions test understanding, not just memorization
✓ MCQ distractors are plausible and educational
✓ Questions are clear and unambiguous
✓ Answers are definitively correct
✓ Concepts accurately tagged
✓ No citation markers or annotations
✓ Even distribution across question types
✓ Appropriate difficulty level throughout
"""


def configure_gemini(api_key: str) -> None:
    """Configure Gemini API with user's API key."""
    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        raise ValueError(f"Failed to configure Gemini API: {str(e)}")


def build_exam_prompt(content: str, config: ExamConfig) -> str:
    """Build the prompt for Gemini based on content and configuration."""
    
    # Build focus concepts section if provided
    focus_concepts_section = ""
    if config.focus_concepts and len(config.focus_concepts) > 0:
        concepts_list = ", ".join(config.focus_concepts)
        focus_concepts_section = f"- Focus on these concepts: {concepts_list}"
    
    # Generation mode guidance
    mode = (config.generation_mode or "strict").lower()
    if mode == "strict":
        source_strategy = (
            "- STRICT SOURCE MODE: All questions MUST be grounded strictly and explicitly in the provided Study Material. "
            "Do NOT introduce facts or topics that are not present in the material."
        )
    elif mode == "creative":
        source_strategy = (
            "- CREATIVE MODE: You may include related or adjacent concepts that are not explicitly in the Study Material as long as they are closely relevant and pedagogically helpful."
        )
    else:  # mixed
        source_strategy = (
            "- MIXED MODE: About half of questions should be grounded strictly in the Study Material, and the rest may include closely-related adjacent concepts to broaden coverage."
        )
    
    # Format question types for display
    question_types_str = ", ".join(config.question_types)
    
    prompt = EXAM_GENERATION_PROMPT.format(
        content=content[:15000],  # Limit content to avoid token limits
        question_count=config.question_count,
        difficulty=config.difficulty,
        question_types=question_types_str,
        focus_concepts_section=f"{focus_concepts_section}\n{source_strategy}"
    )
    
    return prompt


def build_additional_prompt(
    content: str,
    base_config: ExamConfig,
    missing_count: int,
    existing_stems: Optional[List[str]] = None,
) -> str:
    """Build a prompt to request ONLY additional questions, avoiding duplicates.

    Keeps the same structure and constraints but emphasizes generating the remaining
    number of questions and avoiding overlap with provided stems.
    """
    cfg = ExamConfig(
        question_count=missing_count,
        difficulty=base_config.difficulty,
        question_types=base_config.question_types,
        focus_concepts=base_config.focus_concepts,
        generation_mode=base_config.generation_mode,
    )
    base = build_exam_prompt(content, cfg)
    avoid_section = ""
    if existing_stems:
        # Include a compact list of stems to avoid duplicates
        stems_sample = existing_stems[:50]
        joined = "\n- ".join(stems_sample)
        avoid_section = (
            "\n\nAVOID DUPLICATES:\nDo NOT repeat any of these existing question stems.\n- "
            + joined
        )
    return base + avoid_section + "\n\nGenerate additional questions only."


def extract_json_from_response(response_text: str) -> str:
    """
    Extract JSON from Gemini response, handling markdown code blocks and truncation.
    """
    # Log response length for debugging
    print(f"DEBUG: Response length: {len(response_text)} characters")
    
    # Remove markdown code blocks if present
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
    if json_match:
        extracted = json_match.group(1).strip()
    else:
        # Try to find JSON object directly
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            extracted = json_match.group(0).strip()
        else:
            extracted = response_text.strip()
    
    # Check if JSON appears truncated (doesn't end with })
    if not extracted.rstrip().endswith('}'):
        # Try to find the last complete closing brace
        last_brace = extracted.rfind('}')
        if last_brace > 0:
            extracted = extracted[:last_brace + 1]
    
    return extracted


def parse_gemini_response(response_text: str) -> GeneratedExam:
    """
    Parse and validate Gemini's JSON response.
    """
    try:
        # Extract JSON from response
        json_str = extract_json_from_response(response_text)
        
        # Parse JSON
        data = json.loads(json_str)
        
        # Validate structure and create Pydantic models
        exam = GeneratedExam(**data)
        
        # Additional validation
        if len(exam.questions) == 0:
            raise ValueError("No questions generated")
        
        # Validate question types
        valid_types = {'mcq', 'short', 'truefalse', 'cloze', 'multi'}
        for q in exam.questions:
            if q.type not in valid_types:
                q.type = 'short'  # Default to short answer if invalid
            
            # Ensure MCQ questions have options
            if q.type == 'mcq' and (not q.options or len(q.options) < 2):
                raise ValueError(f"MCQ question missing valid options: {q.question}")
        
        return exam
        
    except json.JSONDecodeError as e:
        # Check if response was likely truncated
        if len(response_text) > 15000:
            raise ValueError(
                f"Gemini response appears to be truncated (too many questions requested). "
                f"Try reducing the number of questions or simplifying the request.\n"
                f"Error: {str(e)}"
            )
        raise ValueError(f"Failed to parse JSON from Gemini response: {str(e)}\nResponse: {response_text[:500]}")
    except Exception as e:
        raise ValueError(f"Failed to validate exam structure: {str(e)}")


async def resolve_model_for_key(api_key: str) -> str:
    """Resolve the best available Gemini model for the provided API key.

    Preference order:
    - gemini-2.5-pro (highest quality)
    - gemini-2.5-flash
    - gemini-2.0-flash (cheapest)

    Returns the full model name (e.g., 'models/gemini-2.5-flash') that works with the API.
    Falls back to 'models/gemini-2.5-flash' if discovery fails.
    """
    # Ensure SDK is configured with the key
    configure_gemini(api_key)

    preferred_order = [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
    ]

    try:
        # Some SDKs return names like 'models/gemini-2.5-flash' and include supported methods
        models = list(genai.list_models())
        # Map plain name -> full name (e.g., 'gemini-2.5-flash' -> 'models/gemini-2.5-flash')
        supported_models = {}
        for m in models:
            try:
                methods = getattr(m, 'supported_generation_methods', []) or []
                if 'generateContent' not in methods:
                    continue
                # Get the full model name and normalize to plain model id
                name_raw = getattr(m, 'name', '') or ''
                plain = name_raw.split('/')[-1]
                if plain.endswith('-latest'):
                    plain = plain[:-7]
                # Store the mapping: plain name -> full name
                supported_models[plain] = name_raw
            except Exception:
                continue

        # Return full name for first matching preferred model
        for candidate in preferred_order:
            if candidate in supported_models:
                return supported_models[candidate]  # Return full name that works with the API
        
        # If no preferred model found, return any available model's full name
        if supported_models:
            return next(iter(supported_models.values()))
    except Exception:
        # If listing models fails (network, permission), fall back to a sensible default
        pass

    # Fallback: return a full model name format
    return 'models/gemini-2.5-flash'


async def generate_exam_from_content(
    content: str,
    config: ExamConfig,
    api_key: str
) -> GeneratedExam:
    """
    Main function to generate exam from content using Gemini API.
    
    Args:
        content: Extracted text from study materials
        config: Exam configuration (question count, difficulty, types)
        api_key: User's Gemini API key
    
    Returns:
        GeneratedExam object with metadata and questions
    """
    try:
        # Configure Gemini with user's API key
        configure_gemini(api_key)
        
        # Build prompt
        prompt = build_exam_prompt(content, config)
        
        # Resolve and initialize Gemini model
        model_name = await resolve_model_for_key(api_key)
        model = genai.GenerativeModel(model_name)
        
        # Generate content (run in a worker thread to avoid blocking event loop)
        def _gen(prompt_text: str):
            return model.generate_content(
                prompt_text,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=65536,
                ),
            )
        import asyncio as _asyncio
        response = await _asyncio.to_thread(_gen, prompt)
        
        # Check if response was truncated by checking finish_reason
        try:
            if hasattr(response, 'candidates') and response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                finish_reason = candidate.finish_reason
                
                # Log for debugging
                print(f"DEBUG: Gemini finish_reason: {finish_reason}")
                print(f"DEBUG: Response length: {len(response.text)} characters")
                
                # Check for truncation (finish_reason codes: 1=STOP, 2=MAX_TOKENS, 3=SAFETY, 4=RECITATION)
                if finish_reason == 2 or str(finish_reason) == "MAX_TOKENS":
                    raise ValueError(
                        "Response truncated - too many questions requested. "
                        "The Gemini model's per-request limit was reached. "
                        "Try requesting 10-15 questions instead of 20+."
                    )
                elif finish_reason == 3 or str(finish_reason) == "SAFETY":
                    raise ValueError(
                        "Response blocked by safety filters. "
                        "Try using different study material or requesting simpler questions."
                    )
                elif finish_reason == 4 or str(finish_reason) == "RECITATION":
                    raise ValueError(
                        "Response blocked due to recitation detection. "
                        "Content may be too similar to copyrighted material."
                    )
                elif finish_reason not in [1, "STOP"]:
                    raise ValueError(f"Unexpected finish_reason: {finish_reason}")
        except AttributeError:
            # Response structure doesn't have candidates (shouldn't happen but be safe)
            pass
        
        # Parse response
        exam = parse_gemini_response(response.text)

        # Attach the chosen model name on the fly for upstream usage (stored in metadata by route)
        # We return a tuple via an attribute to avoid breaking existing types elsewhere
        setattr(exam, '_model_name', model_name)
        return exam

    except google_exceptions.NotFound as e:
        raise ValueError(
            "Requested model is not found or unsupported by your key. "
            "The app automatically tries free models like 'gemini-2.5-flash'."
        )
    except google_exceptions.PermissionDenied as e:
        raise ValueError(
            "Your API key lacks access to the selected model. "
            "Please check AI Studio quotas or try a free model like 'gemini-2.5-flash'."
        )
    except Exception as e:
        raise ValueError(f"Failed to generate exam with Gemini: {str(e)}")


async def generate_additional_questions(
    content: str,
    base_config: ExamConfig,
    missing_count: int,
    api_key: str,
    existing_stems: Optional[List[str]] = None,
) -> List[QuestionData]:
    """Request additional questions to top up to the desired count.

    Returns a list of QuestionData (may be empty). Uses the same model and threading
    approach as generate_exam_from_content.
    """
    if missing_count <= 0:
        return []

    try:
        configure_gemini(api_key)
        prompt = build_additional_prompt(content, base_config, missing_count, existing_stems)
        model_name = await resolve_model_for_key(api_key)
        model = genai.GenerativeModel(model_name)

        def _gen(prompt_text: str):
            return model.generate_content(
                prompt_text,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=65536,
                ),
            )

        import asyncio as _asyncio
        response = await _asyncio.to_thread(_gen, prompt)
        exam = parse_gemini_response(response.text)
        return exam.questions or []
    except Exception:
        return []


def dedupe_questions(questions: List[QuestionData]) -> List[QuestionData]:
    """Remove duplicate questions by normalized stem text."""
    seen = set()
    result: List[QuestionData] = []
    for q in questions:
        key = (q.question or "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            result.append(q)
    return result


def synthesize_variants(base_questions: List[QuestionData], needed: int) -> List[QuestionData]:
    """Create simple local variants to fill remaining count safely.

    - MCQ/MULTI: rotate options to produce a different ordering while keeping the
      same correct answer text.
    - Other types: prepend a light rephrase to the stem.
    """
    variants: List[QuestionData] = []
    if needed <= 0 or not base_questions:
        return variants

    idx = 0
    while len(variants) < needed and idx < len(base_questions) * 3:
        src = base_questions[idx % len(base_questions)]
        idx += 1
        new_q = QuestionData(
            question=f"Rephrase: {src.question}",
            answer=src.answer,
            type=src.type,
            options=src.options[:] if src.options else None,
            concepts=src.concepts[:] if src.concepts else [],
            explanation=src.explanation,
        )
        if new_q.type in {"mcq", "multi"} and new_q.options and len(new_q.options) > 1:
            # rotate options by 1
            new_q.options = new_q.options[1:] + new_q.options[:1]
        variants.append(new_q)

    return variants[:needed]


async def generate_chat_response(
    message: str,
    conversation_history: List[Dict[str, str]],
    api_key: str
) -> str:
    """
    Generate a conversational response for the Manual Creator chat interface.
    
    Args:
        message: The user's current message
        conversation_history: Previous messages in format [{"role": "user"|"assistant", "content": "..."}]
        api_key: User's Gemini API key
    
    Returns:
        AI assistant's response text
    """
    try:
        # Configure Gemini with user's API key
        configure_gemini(api_key)
        
        # Build the conversation prompt (friendly and efficient)
        system_instruction = """You're a friendly study assistant helping students create customized practice exams.

INITIAL QUESTIONS (ask together after file upload):
- Question count (1-100)
- Difficulty (Easy/Medium/Hard)
- Question types (Multiple Choice, True/False, Short Answer, Fill-in-the-Blank)

FOLLOW-UP (after basics answered):
- Ask about specific topics/concepts they're struggling with
- Ask if they want focus on particular areas or even distribution
- Ask about question formats they need more practice with

Keep responses to 2-3 sentences. Acknowledge uploaded files immediately."""

        # Build full conversation context (keep only recent history to save tokens)
        conversation_text = system_instruction + "\n\n"
        
        # Limit conversation history to last 6 messages to prevent token bloat
        recent_history = conversation_history[-6:] if len(conversation_history) > 6 else conversation_history
        
        # Add conversation history
        for msg in recent_history:
            role = "User" if msg["role"] == "user" else "Assistant"
            conversation_text += f"{role}: {msg['content']}\n\n"
        
        # Add current message
        conversation_text += f"User: {message}\n\nAssistant:"
        
        # Track response time
        start_time = time.time()
        
        # Resolve and initialize Gemini model
        model_name = await resolve_model_for_key(api_key)
        model = genai.GenerativeModel(model_name)
        
        # Generate response with conversational settings
        def _gen(prompt_text: str):
            return model.generate_content(
                prompt_text,
                generation_config=genai.GenerationConfig(
                    temperature=0.85,  # Higher for more natural, varied responses
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=8192,  # Large limit to prevent cutoffs, still has safety cap
                ),
            )
        
        import asyncio as _asyncio
        
        # Generate response (no timeout - let Gemini take as long as needed)
        response = await _asyncio.to_thread(_gen, conversation_text)
        
        # Initialize response text variable
        response_text = ""
        
        # Check finish reason and extract text appropriately
        try:
            if hasattr(response, 'candidates') and response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                finish_reason = candidate.finish_reason
                
                # Extract text from parts for ALL cases (safer than using .text accessor)
                if candidate.content and candidate.content.parts:
                    parts_text = []
                    for part in candidate.content.parts:
                        if hasattr(part, 'text') and part.text:
                            parts_text.append(part.text)
                    response_text = ' '.join(parts_text).strip()
                
                # Handle different finish reasons
                if finish_reason == 3 or str(finish_reason) == "SAFETY":
                    return "I apologize, but I'm unable to respond to that message due to content safety filters. Could you rephrase your question or try a different topic?"
                elif finish_reason == 2 or str(finish_reason) == "MAX_TOKENS":
                    # Response was cut off at token limit - just return what we got
                    if response_text and len(response_text) > 10:
                        return response_text  # Return the partial response without error message
                    else:
                        return "I apologize, but I couldn't generate a response. Please try rephrasing your message."
            else:
                # Try fallback .text accessor if candidates structure is different
                try:
                    response_text = response.text.strip()
                except Exception:
                    raise ValueError("No valid response structure from AI model")
        except AttributeError as e:
            # If structure is completely unexpected
            raise ValueError(f"Unexpected response structure: {str(e)}")
        
        # Ensure we got a valid response
        if not response_text or len(response_text) < 3:
            raise ValueError("Empty or invalid response from AI model")
        
        elapsed = time.time() - start_time
        print(f"[Chat] Response received in {elapsed:.2f}s, length: {len(response_text)} chars")
        
        return response_text
        
    except google_exceptions.NotFound as e:
        raise ValueError(
            "Requested model is not found or unsupported by your key. "
            "Please check your API key configuration."
        )
    except google_exceptions.PermissionDenied as e:
        raise ValueError(
            "Your API key lacks access to the selected model. "
            "Please check your API key permissions."
        )
    except Exception as e:
        raise ValueError(f"Failed to generate chat response: {str(e)}")


async def validate_api_key(api_key: str) -> bool:
    """
    Validate that the provided Gemini API key works by discovering available models dynamically.
    Returns True if key is valid; raises with a descriptive error otherwise.
    
    This function uses the same approach as resolve_model_for_key() to discover
    what models are actually available rather than trying hardcoded names.
    """
    # Configure Gemini SDK with the provided API key
    configure_gemini(api_key)
    
    try:
        # Discover available models (same approach as resolve_model_for_key)
        models = list(genai.list_models())
        supported_models = []
        
        # Find models that support generateContent
        for m in models:
            try:
                methods = getattr(m, 'supported_generation_methods', []) or []
                if 'generateContent' in methods:
                    name_raw = getattr(m, 'name', '') or ''
                    # Normalize to plain model id without 'models/' prefix or '-latest' suffix
                    plain = name_raw.split('/')[-1]
                    if plain.endswith('-latest'):
                        plain = plain[:-7]
                    supported_models.append((plain, name_raw))
            except Exception:
                continue
        
        if not supported_models:
            raise ValueError(
                "No models with generateContent support found. "
                "Please check your API key has proper permissions at: "
                "https://aistudio.google.com/app/apikey"
            )
        
        # Try the first available model
        last_error = None
        for plain_name, full_name in supported_models:
            try:
                model = genai.GenerativeModel(full_name)
                response = model.generate_content(
                    "Say 'OK' if you can read this.",
                    generation_config=genai.GenerationConfig(
                        max_output_tokens=10,
                    )
                )
                
                # Extract response text
                text = getattr(response, 'text', None)
                if not text:
                    try:
                        candidates = getattr(response, 'candidates', []) or []
                        if candidates and candidates[0].content and candidates[0].content.parts:
                            part0 = candidates[0].content.parts[0]
                            text = getattr(part0, 'text', None)
                    except Exception:
                        pass
                
                if not text:
                    last_error = f"Empty response from model '{full_name}'"
                    continue
                
                # Success! This model works
                return True
                
            except google_exceptions.NotFound:
                last_error = f"Model '{full_name}' not found"
                continue
            except google_exceptions.PermissionDenied:
                last_error = f"Permission denied for model '{full_name}'"
                continue
            except google_exceptions.GoogleAPIError as e:
                last_error = f"Google API error with '{full_name}': {str(e)}"
                continue
            except Exception as e:
                last_error = f"Error with '{full_name}': {str(e)}"
                continue
        
        # All discovered models failed
        error_msg = (
            f"Unable to access any Gemini models. "
            f"Tried {len(supported_models)} available models.\n"
            f"Last error: {last_error}\n\n"
            f"Please verify your API key is valid and active at: "
            f"https://aistudio.google.com/app/apikey"
        )
        raise ValueError(error_msg)
        
    except Exception as e:
        # If listing models fails, provide helpful error
        error_msg = (
            f"Failed to validate API key: {str(e)}\n\n"
            f"Please ensure:\n"
            f"  1. Your API key is valid and active\n"
            f"  2. You have internet connectivity\n"
            f"  3. Your firewall is not blocking Google APIs\n"
            f"\n"
            f"Get or verify your API key at: https://aistudio.google.com/app/apikey"
        )
        raise ValueError(error_msg)


async def generate_answer_explanation(
    question_stem: str,
    question_type: str,
    correct_answer: Any,
    user_answer: Any,
    options: Optional[List[str]],
    api_key: str
) -> str:
    """
    Generate a concise AI explanation for why an answer is incorrect.
    Returns a 2-3 sentence explanation comparing the user's answer to the correct answer.
    """
    if not api_key or not api_key.strip():
        return ""
    
    configure_gemini(api_key)
    
    # Format answers for display
    user_ans_str = str(user_answer) if user_answer is not None else "No answer provided"
    correct_ans_str = str(correct_answer) if correct_answer is not None else "N/A"
    
    # Build context based on question type
    question_context = f"Question: {question_stem}\n"
    if options and len(options) > 0:
        question_context += f"Options: {', '.join(options)}\n"
    question_context += f"Correct Answer: {correct_ans_str}\n"
    question_context += f"Student's Answer: {user_ans_str}\n"
    
    prompt = f"""{question_context}

Provide a brief, helpful explanation (2-3 sentences) for why the student's answer is incorrect and why the correct answer is right. Be concise and educational.

Focus on:
1. Why the correct answer is right
2. What misconception might have led to the student's choice (if applicable)

Keep it under 100 words."""
    
    try:
        # Use the same model resolution approach as other functions
        model_name = resolve_model_for_key(api_key)
        model = genai.GenerativeModel(model_name)
        
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                top_p=0.9,
                top_k=40,
                max_output_tokens=200,  # Keep explanations concise
            ),
        )
        
        explanation = response.text.strip()
        return explanation if explanation else ""
        
    except Exception as e:
        print(f"[Explanation] Failed to generate: {str(e)}")
        # Return empty string on failure - don't block the grading process
        return ""


async def generate_performance_insights(
    timeline_data: List[Dict[str, Any]],
    question_type_stats: Dict[str, Any],
    source_material_stats: Dict[str, Any],
    api_key: str
) -> str:
    """
    Generate AI-powered performance insights from analytics data.
    Returns 2-3 sentence actionable summary of student performance.
    """
    if not api_key or not api_key.strip():
        return "Add your Gemini API key to generate personalized performance insights."
    
    configure_gemini(api_key)
    
    # Prepare summary data
    recent_attempts = timeline_data[-5:] if len(timeline_data) >= 5 else timeline_data
    
    # Format timeline summary
    timeline_summary = []
    for attempt in recent_attempts:
        timeline_summary.append(f"Score: {attempt['score']}% on {attempt['date'][:10]}")
    
    # Find strongest and weakest question types
    sorted_qtypes = sorted(
        question_type_stats.items(),
        key=lambda x: x[1]["accuracy"],
        reverse=True
    )
    strongest_type = sorted_qtypes[0] if sorted_qtypes else None
    weakest_type = sorted_qtypes[-1] if sorted_qtypes else None
    
    # Find best and worst performing sources
    sorted_sources = sorted(
        source_material_stats.items(),
        key=lambda x: x[1]["accuracy"],
        reverse=True
    )
    best_source = sorted_sources[0] if sorted_sources else None
    worst_source = sorted_sources[-1] if sorted_sources else None
    
    # Build prompt
    prompt = f"""Analyze this student's exam performance data and provide 2-3 actionable insights:

RECENT PERFORMANCE:
{chr(10).join(timeline_summary)}

QUESTION TYPE PERFORMANCE:
{chr(10).join([f"- {qtype}: {stats['accuracy']}% accuracy ({stats['correct']}/{stats['total']})" for qtype, stats in question_type_stats.items()])}

SOURCE MATERIAL PERFORMANCE:
{chr(10).join([f"- {source}: {stats['accuracy']}% accuracy ({stats['question_count']} questions, {stats['appearances']} exam appearances)" for source, stats in source_material_stats.items()])}

Provide 2-3 sentences focusing on:
1. Overall performance trends (improving, declining, or stable)
2. Specific strengths or weaknesses in question formats
3. Study material recommendations based on source performance
4. One specific, actionable next step

Keep the tone conversational and encouraging. Be specific with numbers when relevant."""

    try:
        model_name = resolve_model_for_key(api_key)
        model = genai.GenerativeModel(model_name)
        
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.8,
                top_p=0.9,
                top_k=40,
                max_output_tokens=300,
            ),
        )
        
        insights = response.text.strip()
        return insights if insights else "Unable to generate insights at this time."
        
    except Exception as e:
        print(f"[Performance Insights] Failed to generate: {str(e)}")
        return f"Unable to generate insights: {str(e)}"

