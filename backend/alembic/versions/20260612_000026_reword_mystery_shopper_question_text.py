"""reword mystery shopper question text for clarity and consistency

Revision ID: 20260612_000026
Revises: 20260612_000025
Create Date: 2026-06-12 12:00:00

All 27 question texts rewritten to be:
- Proper questions with question marks
- Consistent sentence case (no random capitalisation)
- Plain language suitable for a non-technical shopper
- Free of truncations, ampersands, and jargon (NPS replaced)
"""

from alembic import op
from sqlalchemy import text

revision = "20260612_000026"
down_revision = "20260612_000025"
branch_labels = None
depends_on = None

_NEW_TEXT: dict[str, str] = {
    "ms_signage_visibility_cleanliness":    "Was the store signage clearly visible and well maintained?",
    "ms_store_entrance_cleanliness":        "How clean was the store entrance?",
    "ms_promotional_material_display":      "How well were promotional materials displayed?",
    "ms_greeted_within_30_seconds":         "Were you greeted within 30 seconds of entering?",
    "ms_greeting_polite_warm":              "Was the greeting polite and welcoming?",
    "ms_store_cleanliness":                 "How clean was the inside of the store?",
    "ms_queue_management":                  "How well was the queue organised and managed?",
    "ms_display_organization_posters":      "How well presented were the product displays and posters?",
    "ms_aircon_ventilation":                "How comfortable was the temperature and ventilation?",
    "ms_space_comfort":                     "How comfortable and spacious did the store feel?",
    "ms_uniform_neat_complete":             "Was the staff uniform neat and complete?",
    "ms_personal_grooming":                 "How well presented was the staff member's appearance?",
    "ms_name_badge_visibility":             "How visible was the staff member's name badge?",
    "ms_professional_behaviour":            "Did the staff member behave in a professional manner?",
    "ms_listened_actively":                 "Did the staff member listen to you attentively?",
    "ms_asked_relevant_questions":          "Did the staff member ask relevant questions to understand your needs?",
    "ms_product_service_knowledge":         "How knowledgeable was the staff member about products and services?",
    "ms_information_accuracy":              "How accurate was the information provided to you?",
    "ms_handled_clarifying_questions":      "How well did the staff member handle your follow-up questions?",
    "ms_solution_provided":                 "Was a solution or resolution provided to you?",
    "ms_solution_helpful":                  "Was the solution provided helpful?",
    "ms_waiting_time":                      "How long did you wait before being served?",
    "ms_service_completion_time":           "How would you rate the overall time taken to complete your service?",
    "ms_staff_interaction_satisfaction":    "How satisfied were you with your interaction with the staff?",
    "ms_store_environment_satisfaction":    "How satisfied were you with the overall store environment?",
    "ms_recommend_outlet_nps":              "How likely are you to recommend this store to a friend or family member?",
    "ms_final_comments":                    "Any additional comments or suggestions?",
}

_OLD_TEXT: dict[str, str] = {
    "ms_signage_visibility_cleanliness":    "How is Signage visibility & cleanliness",
    "ms_store_entrance_cleanliness":        "How is Store entrance cleanliness",
    "ms_promotional_material_display":      "Rate the display of Promotional materials",
    "ms_greeted_within_30_seconds":         "Greeted within 30 seconds",
    "ms_greeting_polite_warm":              "Greeting polite & warm",
    "ms_store_cleanliness":                 "Cleanliness of store",
    "ms_queue_management":                  "Queue management",
    "ms_display_organization_posters":      "Display organisation and posters",
    "ms_aircon_ventilation":                "Air conditioning / ventilation",
    "ms_space_comfort":                     "Space & comfort",
    "ms_uniform_neat_complete":             "Are staff Uniform neat and complete",
    "ms_personal_grooming":                 "How is the staff Personal grooming of",
    "ms_name_badge_visibility":             "Rate the Name badge visibility",
    "ms_professional_behaviour":            "Do staff act with Professional behaviour",
    "ms_listened_actively":                 "Did staff listen actively",
    "ms_asked_relevant_questions":          "Did staff Ask relevant questions",
    "ms_product_service_knowledge":         "Rate Staff Product/service knowledge",
    "ms_information_accuracy":              "How was the Accuracy of information Provided",
    "ms_handled_clarifying_questions":      "Handled clarifying questions",
    "ms_solution_provided":                 "Was a Solution provided",
    "ms_solution_helpful":                  "Was the Solution helpful",
    "ms_waiting_time":                      "Waiting time",
    "ms_service_completion_time":           "Service completion (handling time)",
    "ms_staff_interaction_satisfaction":    "Staff interaction satisfaction",
    "ms_store_environment_satisfaction":    "Store environment satisfaction",
    "ms_recommend_outlet_nps":              "NPS - Recommend this outlet",
    "ms_final_comments":                    "Final comments / recommendations",
}


def _apply(mapping: dict[str, str]) -> None:
    conn = op.get_bind()
    for key, text_value in mapping.items():
        conn.execute(
            text("UPDATE questions SET question_text = :t WHERE question_key = :k"),
            {"t": text_value, "k": key},
        )


def upgrade() -> None:
    _apply(_NEW_TEXT)


def downgrade() -> None:
    _apply(_OLD_TEXT)
