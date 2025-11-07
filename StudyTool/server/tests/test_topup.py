from StudyTool.server.services.gemini_service import QuestionData, dedupe_questions, synthesize_variants


def test_dedupe_questions_simple():
    a = QuestionData(question="What is A?", answer="A", type="short", options=None, concepts=[])
    b = QuestionData(question="what is a?", answer="A", type="short", options=None, concepts=[])
    c = QuestionData(question="What is B?", answer="B", type="short", options=None, concepts=[])
    out = dedupe_questions([a, b, c])
    stems = [q.question for q in out]
    assert len(out) == 2
    assert "What is A?" in stems and "What is B?" in stems


def test_synthesize_variants_mcq_rotation():
    base = QuestionData(
        question="Pick the capital of France",
        answer="Paris",
        type="mcq",
        options=["London", "Paris", "Berlin", "Rome"],
        concepts=["geography"],
        explanation=None,
    )
    variants = synthesize_variants([base], 1)
    assert len(variants) == 1
    v = variants[0]
    assert v.answer == "Paris"
    assert v.options is not None and len(v.options) == 4
    # rotated once
    assert v.options[0] == "Paris" or v.options[-1] == "London"


