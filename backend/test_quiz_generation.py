import json
import unittest

from quiz_generation import build_quiz_prompt, parse_quiz_response, validate_quiz_request


def request_settings(**overrides):
    values = {
        "notes": "Photosynthesis converts light energy into chemical energy in plants. Chlorophyll absorbs light, and carbon dioxide and water are used to produce glucose and oxygen.",
        "title": "Photosynthesis",
        "subject": "Biology",
        "count": 5,
        "type": "Multiple choice",
        "difficulty": "Medium",
        "includeExplanations": True,
    }
    values.update(overrides)
    return validate_quiz_request(values)


def multiple_choice_questions(count=5):
    return [{
        "question": f"What is the role of component {index}?",
        "options": [f"Choice {index}A", f"Choice {index}B", f"Choice {index}C", f"Choice {index}D"],
        "correctAnswer": f"Choice {index}A",
        "type": "Multiple choice",
        "hint": "Recall the lecture definition.",
        "explanation": "The lecture explains this role.",
    } for index in range(count)]


class QuizGenerationTests(unittest.TestCase):
    def test_validates_custom_settings_without_replacing_them(self):
        request = request_settings(count=15, type="True / False", difficulty="Hard", includeExplanations=False)
        self.assertEqual(request["count"], 15)
        self.assertEqual(request["type"], "True / False")
        self.assertEqual(request["difficulty"], "Hard")
        self.assertFalse(request["includeExplanations"])

    def test_rejects_invalid_length_and_missing_source(self):
        with self.assertRaisesRegex(ValueError, "5, 10, 15, or 20"):
            request_settings(count=7)
        with self.assertRaisesRegex(ValueError, "at least 80 characters"):
            request_settings(notes="short")

    def test_prompt_asks_for_exact_count_type_difficulty_and_grounding(self):
        request = request_settings(count=10, type="Mixed", difficulty="Easy")
        prompt = build_quiz_prompt(request)
        self.assertIn("exactly 10 distinct questions", prompt)
        self.assertIn("balanced mix", prompt)
        self.assertIn("Easy difficulty", prompt)
        self.assertIn("only facts supported by the lecture source", prompt)

    def test_parses_markdown_fenced_response_and_enforces_four_choices(self):
        request = request_settings()
        raw = json.dumps({"questions": multiple_choice_questions()})
        questions = parse_quiz_response(f"```json\n{raw}\n```", request)
        self.assertEqual(len(questions), 5)
        self.assertTrue(all(len(question["options"]) == 4 for question in questions))
        self.assertTrue(all(question["correctAnswer"] in question["options"] for question in questions))
        self.assertTrue(all(question["explanation"] for question in questions))

    def test_requires_exact_count_unique_questions_and_valid_answer(self):
        request = request_settings()
        with self.assertRaisesRegex(ValueError, "returned 4 of 5"):
            parse_quiz_response(json.dumps({"questions": multiple_choice_questions(4)}), request)

        duplicate_questions = multiple_choice_questions()
        duplicate_questions[1]["question"] = duplicate_questions[0]["question"].upper()
        with self.assertRaisesRegex(ValueError, "duplicates another"):
            parse_quiz_response(json.dumps({"questions": duplicate_questions}), request)

        invalid_answer_questions = multiple_choice_questions()
        invalid_answer_questions[0]["correctAnswer"] = "Not a choice"
        with self.assertRaisesRegex(ValueError, "correct answer matching"):
            parse_quiz_response(json.dumps({"questions": invalid_answer_questions}), request)

        invalid_choice_questions = multiple_choice_questions()
        invalid_choice_questions[0]["options"] = ["Only", "three", "choices"]
        with self.assertRaisesRegex(ValueError, "exactly four"):
            parse_quiz_response(json.dumps({"questions": invalid_choice_questions}), request)

    def test_mixed_quiz_requires_both_question_types(self):
        request = request_settings(type="Mixed")
        questions = multiple_choice_questions()
        with self.assertRaisesRegex(ValueError, "requested mix"):
            parse_quiz_response(json.dumps({"questions": questions}), request)

    def test_mixed_quiz_requires_a_balanced_type_distribution(self):
        request = request_settings(type="Mixed")
        questions = multiple_choice_questions()
        questions[0]["type"] = "True / False"
        questions[0]["options"] = ["True", "False"]
        questions[0]["correctAnswer"] = "True"
        with self.assertRaisesRegex(ValueError, "balanced mix"):
            parse_quiz_response(json.dumps({"questions": questions}), request)

    def test_explanation_toggle_is_enforced(self):
        request = request_settings(includeExplanations=False)
        questions = multiple_choice_questions()
        questions[0]["explanation"] = "Model supplied explanation."
        parsed = parse_quiz_response(json.dumps({"questions": questions}), request)
        self.assertEqual(parsed[0]["explanation"], "")


if __name__ == "__main__":
    unittest.main()
