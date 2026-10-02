import json
import re
import unicodedata


QUESTION_TYPES = {
    "Multiple choice",
    "True / False",
    "Multi-select",
    "Problem solving",
    "Mixed",
}
DIFFICULTIES = {"Easy", "Medium", "Hard"}
QUESTION_COUNTS = {5, 10, 15, 20}


def validate_quiz_request(payload):
    if not isinstance(payload, dict):
        raise ValueError("The quiz request was not valid JSON.")

    notes = payload.get("notes")
    if not isinstance(notes, str) or len(notes.strip()) < 80:
        raise ValueError("Add at least 80 characters of readable lecture notes before generating a quiz.")
    if len(notes) > 120_000:
        raise OverflowError("This lecture has too much text. Use up to 120,000 characters.")

    count = payload.get("count")
    if isinstance(count, bool) or not isinstance(count, int) or count not in QUESTION_COUNTS:
        raise ValueError("Choose a quiz length of 5, 10, 15, or 20 questions.")

    question_type = payload.get("type")
    if not isinstance(question_type, str) or question_type not in QUESTION_TYPES:
        raise ValueError("Choose a supported quiz question type.")

    difficulty = payload.get("difficulty")
    if not isinstance(difficulty, str) or difficulty not in DIFFICULTIES:
        raise ValueError("Choose Easy, Medium, or Hard difficulty.")

    include_explanations = payload.get("includeExplanations")
    if not isinstance(include_explanations, bool):
        raise ValueError("The explanation preference must be enabled or disabled.")

    title = payload.get("title", "Lecture notes")
    subject = payload.get("subject", "")
    if not isinstance(title, str) or not isinstance(subject, str):
        raise ValueError("The lecture title and subject must be text.")

    return {
        "notes": notes.strip(),
        "title": title.strip()[:300] or "Lecture notes",
        "subject": subject.strip()[:200],
        "count": count,
        "type": question_type,
        "difficulty": difficulty,
        "includeExplanations": include_explanations,
    }


def build_quiz_prompt(request):
    question_type = request["type"]
    type_instruction = (
        "Include a balanced mix of Multiple choice and True / False questions, with at least one of each."
        if question_type == "Mixed"
        else f"Every question must use exactly this type: {question_type}."
    )
    explanation_instruction = (
        "Give each question a concise explanation for its correct answer."
        if request["includeExplanations"]
        else "Set every explanation value to an empty string."
    )
    prompt = (
        "Create a quiz using only facts supported by the lecture source. "
        f"Return exactly {request['count']} distinct questions at {request['difficulty']} difficulty. "
        f"{type_instruction} "
        "For Multiple choice and Problem solving questions, provide exactly four distinct answer choices "
        "and one correctAnswer that exactly matches one choice. "
        "For True / False questions, provide exactly the choices True and False and use one of them as correctAnswer. "
        "For Multi-select questions, provide four distinct choices and a non-empty correctAnswer array containing "
        "only choices that are correct. Do not create duplicate or empty questions, invent unsupported facts, "
        "or include markdown. Each question must include a short hint. "
        "Return a JSON object with a questions array. Each question object must contain question, options, "
        "correctAnswer, type, hint, and explanation. "
        f"Requested type: {question_type}. "
        f"{explanation_instruction}"
    )
    return (
        f"{prompt}\n\nLecture: {request['title']}\nSubject: {request['subject'] or 'Not provided'}"
        f"\n\nLECTURE SOURCE:\n{request['notes']}"
    )


def parse_quiz_response(response_text, request):
    if not isinstance(response_text, str) or not response_text.strip():
        raise ValueError("Gemini returned an empty quiz.")

    content = response_text.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", content, re.IGNORECASE | re.DOTALL)
    if fenced:
        content = fenced.group(1).strip()
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as error:
        raise ValueError("Gemini returned quiz data that was not valid JSON.") from error

    raw_questions = payload.get("questions") if isinstance(payload, dict) else None
    if not isinstance(raw_questions, list):
        raise ValueError("Gemini did not return a questions array.")
    if len(raw_questions) != request["count"]:
        raise ValueError(
            f"Gemini returned {len(raw_questions)} of {request['count']} requested questions. Try generating again."
        )

    questions = []
    seen_questions = set()
    for index, item in enumerate(raw_questions):
        if not isinstance(item, dict):
            raise ValueError(f"Question {index + 1} was not a valid question object.")
        question = item.get("question")
        options = item.get("options")
        question_type = item.get("type", request["type"])
        answer = item.get("correctAnswer")
        if not isinstance(question, str) or not question.strip() or not isinstance(options, list):
            raise ValueError(f"Question {index + 1} is missing its question text or answer choices.")

        options = [option.strip() for option in options if isinstance(option, str) and option.strip()]
        if len(options) != len({option.casefold() for option in options}):
            raise ValueError(f"Question {index + 1} contains duplicate answer choices.")
        normalized = unicodedata.normalize("NFKC", question).casefold()
        normalized = re.sub(r"[\W_]+", " ", normalized).strip()
        if not normalized or normalized in seen_questions:
            raise ValueError(f"Question {index + 1} is empty or duplicates another question.")
        seen_questions.add(normalized)

        if request["type"] != "Mixed" and question_type != request["type"]:
            raise ValueError(f"Question {index + 1} does not use the requested question type.")
        if not isinstance(question_type, str) or question_type not in QUESTION_TYPES - {"Mixed"}:
            raise ValueError(f"Question {index + 1} has an unsupported question type.")
        if question_type in {"Multiple choice", "Problem solving", "Multi-select"} and len(options) != 4:
            raise ValueError(f"Question {index + 1} must have exactly four distinct answer choices.")
        if question_type == "True / False" and set(options) != {"True", "False"}:
            raise ValueError(f"Question {index + 1} must have True and False answer choices.")

        if question_type == "Multi-select":
            if not isinstance(answer, list) or not answer or any(value not in options for value in answer):
                raise ValueError(f"Question {index + 1} must identify one or more correct choices.")
            answer = list(dict.fromkeys(answer))
        elif not isinstance(answer, str) or answer.strip() not in options:
            raise ValueError(f"Question {index + 1} must have a correct answer matching one of its choices.")
        else:
            answer = answer.strip()

        explanation = item.get("explanation", "")
        hint = item.get("hint", "")
        if not isinstance(explanation, str) or not isinstance(hint, str):
            raise ValueError(f"Question {index + 1} has invalid explanation or hint text.")
        if request["includeExplanations"] and not explanation.strip():
            raise ValueError(f"Question {index + 1} is missing the requested explanation.")
        if len(explanation.strip()) > 500:
            raise ValueError(f"Question {index + 1} explanation is too long; keep it concise.")

        questions.append({
            "id": f"generated-{index + 1}",
            "question": question.strip(),
            "options": options,
            "correctAnswer": answer,
            "answer": answer,
            "type": question_type,
            "difficulty": request["difficulty"],
            "hint": hint.strip(),
            "explanation": explanation.strip() if request["includeExplanations"] else "",
        })
    if request["type"] == "Mixed":
        type_counts = {
            question_type: sum(question["type"] == question_type for question in questions)
            for question_type in ("Multiple choice", "True / False")
        }
        if not all(type_counts.values()):
            raise ValueError("Gemini did not return the requested mix of question types. Try generating again.")
        if abs(type_counts["Multiple choice"] - type_counts["True / False"]) > 1:
            raise ValueError("Gemini did not return a balanced mix of question types. Try generating again.")
    return questions
