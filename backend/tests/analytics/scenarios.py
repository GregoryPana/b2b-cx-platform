"""Hand-computed two-module scenario shared by the analytics assurance tests.

Every expected figure used by the tests is written out as a literal next to the
data that produces it (arithmetic shown in comments) - never recomputed with
the application's formulas.
"""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace


def seed_two_modules(fx) -> SimpleNamespace:
    """B2B + Mystery Shopper data in one database, with Mystery answers mirrored
    into b2b_visit_responses exactly as the application dual-writes them."""
    ns = SimpleNamespace()

    # ---------------- B2B ----------------
    ns.b1 = fx.business("Alpha Ltd")
    ns.b2 = fx.business("Bravo Ltd")
    ns.b3 = fx.business("Charlie Ltd (retired)", active=False)

    ns.v1 = fx.b2b_visit(ns.b1, "Approved", date(2026, 3, 1), ae="Alice")
    fx.answer(ns.v1, "q11_recommend_nps", 10)
    fx.answer(ns.v1, "q12_overall_satisfaction", 9)
    fx.answer(ns.v1, "q01_relationship_strength", 8)
    fx.answer(ns.v1, "q02_ae_information_updates", 9)
    fx.answer(ns.v1, "q16_other_provider_products", None, "Y")
    fx.answer(ns.v1, "q20_comments", None, "ok")
    fx.answer(ns.v1, "q04_ae_business_understanding", None, "Yes")
    fx.answer(ns.v1, "q06_regular_updates", None, "No")

    ns.v2 = fx.b2b_visit(ns.b2, "Approved", date(2026, 3, 5), ae="Bob")
    fx.answer(ns.v2, "q11_recommend_nps", 6)
    fx.answer(ns.v2, "q12_overall_satisfaction", 8)
    fx.answer(ns.v2, "q01_relationship_strength", 6)
    fx.answer(ns.v2, "q16_other_provider_products", None, "Y")
    fx.answer(ns.v2, "q04_ae_business_understanding", None, "Yes")

    ns.v3 = fx.b2b_visit(ns.b3, "Approved", date(2026, 3, 9))
    fx.answer(ns.v3, "q11_recommend_nps", 9)
    fx.answer(ns.v3, "q12_overall_satisfaction", 5)
    fx.answer(ns.v3, "q01_relationship_strength", 4)
    fx.answer(ns.v3, "q20_comments", None, "")

    ns.v4 = fx.b2b_visit(ns.b1, "Approved", date(2026, 3, 20), ae="Alice")
    fx.answer(ns.v4, "q11_recommend_nps", 8)
    fx.answer(ns.v4, "q12_overall_satisfaction", 10)
    fx.answer(ns.v4, "q01_relationship_strength", 10)
    fx.answer(ns.v4, "q02_ae_information_updates", 5)
    fx.answer(ns.v4, "q05_contacts_visit_satisfaction", 7)
    fx.answer(ns.v4, "q16_other_provider_products", None, "N")
    fx.answer(ns.v4, "q04_ae_business_understanding", None, "No")
    fx.answer(ns.v4, "q06_regular_updates", None, "Yes")

    # Non-approved B2B visits must never reach approved-only KPIs.
    ns.v5 = fx.b2b_visit(ns.b1, "Draft", date(2026, 3, 25))
    fx.answer(ns.v5, "q11_recommend_nps", 0)
    fx.answer(ns.v5, "q16_other_provider_products", None, "Y")
    ns.v6 = fx.b2b_visit(ns.b2, "Pending", date(2026, 3, 26))
    ns.v7 = fx.b2b_visit(ns.b3, "Rejected", date(2026, 3, 27))
    ns.v8 = fx.b2b_visit(ns.b1, "Needs Changes", date(2026, 3, 28))

    # ---------------- Mystery Shopper ----------------
    ns.l1 = fx.location("Anse Aux Pins")
    ns.l2 = fx.location("Victoria")

    ns.m1 = fx.mystery_visit(ns.l1, "Approved", date(2026, 3, 2), staff="Ana", purpose="Billing")
    fx.mystery_scores(ns.m1, nps=0, staff_sat=4, store_sat=6, ms_store_cleanliness=3, ms_space_comfort=4)
    fx.mystery_answer(ns.m1, "ms_waiting_time", None, "Under 5 min")
    fx.mystery_answer(ns.m1, "ms_service_completion_time", None, "Same day")
    fx.mystery_answer(ns.m1, "ms_greeted_within_30_seconds", None, "Yes")

    ns.m2 = fx.mystery_visit(ns.l1, "Approved", date(2026, 3, 6), staff="Ana", purpose="Billing")
    fx.mystery_scores(ns.m2, nps=7, staff_sat=8, store_sat=10, ms_store_cleanliness=5, ms_space_comfort=2)
    fx.mystery_answer(ns.m2, "ms_waiting_time", None, "5-10 min")
    fx.mystery_answer(ns.m2, "ms_greeted_within_30_seconds", None, "No")

    ns.m3 = fx.mystery_visit(ns.l2, "Approved", date(2026, 3, 12), staff="Ben", purpose="Fault")
    fx.mystery_scores(ns.m3, nps=8, staff_sat=9, store_sat=9, ms_store_cleanliness=4, ms_space_comfort=4)
    fx.mystery_answer(ns.m3, "ms_final_comments", None, "Great")
    fx.mystery_answer(ns.m3, "ms_waiting_time", None, "")
    fx.mystery_answer(ns.m3, "ms_greeted_within_30_seconds", None, "Yes")

    ns.m4 = fx.mystery_visit(ns.l1, "Draft", date(2026, 3, 14))
    fx.mystery_scores(ns.m4, nps=10, staff_sat=10, store_sat=10)
    fx.mystery_answer(ns.m4, "ms_greeted_within_30_seconds", None, "Yes")
    ns.m5 = fx.mystery_visit(ns.l2, "Pending", date(2026, 3, 15))
    fx.mystery_scores(ns.m5, nps=10, staff_sat=10)
    ns.m6 = fx.mystery_visit(ns.l2, "Rejected", date(2026, 3, 16))
    fx.mystery_scores(ns.m6, nps=10)
    ns.m7 = fx.mystery_visit(ns.l1, "Needs Changes", date(2026, 3, 17))
    return ns


# ---- Expected values (hand computed) ------------------------------------
# B2B approved NPS answers [10, 6, 9, 8]: promoters 2 (10,9), passives 1 (8),
# detractors 1 (6), total 4 -> 50% - 25% = 25.0
B2B_NPS = {"nps": 25.0, "promoters": 2, "passives": 1, "detractors": 1, "total_responses": 4}
# B2B q12 approved [9, 8, 5, 10]: very_satisfied 2 (9,10), satisfied 1 (8), neutral 1 (5)
# CSAT = (1 + 2) / 4 = 75.0 ; mean = 32 / 4 = 8.0
B2B_CSAT = {"csat_score": 75.0, "response_count": 4, "avg_score": 8.0,
            "dist": {"very_dissatisfied": 0, "dissatisfied": 0, "neutral": 1, "satisfied": 1, "very_satisfied": 2}}
# Latest approved visit per business (b1->v4, b2->v2, b3->v3), relationship scores:
# b1: q01 10 + q02 5 + q05 7 = 22 of 30 ; b2: q01 6 of 10 ; b3: q01 4 of 10 -> 32 / 50 = 64.0
# mean of the five answers = 32 / 5 = 6.4
B2B_RELATIONSHIP = {"score": 64.0, "avg_score": 6.4, "total_score": 32.0, "possible_score": 50.0, "questions_answered": 5}
# Latest visits: b1 q16 'N', b2 q16 'Y', b3 no answer -> 1 of 3 accounts = 33.33
B2B_EXPOSURE = {"exposure_rate": 33.33, "total_accounts": 3, "accounts_using_competitors": 1}
# Approved B2B non-empty answer_text rows: v1 {Y, ok, Yes, No}=4 ; v2 {Y, Yes}=2 ; v3 {''}=0 ; v4 {N, No, Yes}=3
B2B_TEXT_RESPONSES = 9
# 8 B2B visits: Approved 4, Draft 1, Pending 1, Rejected 1, Needs Changes 1 (`completed` is a legacy alias of approved)
B2B_VISITS = {"total": 8, "draft": 1, "pending": 1, "needs_changes": 1, "completed": 4, "approved": 4, "rejected": 1}

# Mystery approved NPS answers [0, 7, 8]: promoters 0, passives 2, detractors 1 -> -33.33
MS_NPS = {"nps": -33.33, "promoters": 0, "passives": 2, "detractors": 1, "total_responses": 3}
# Pooled CSAT answers (staff + store) m1 [4,6] m2 [8,10] m3 [9,9]: 46 / 6 = 7.67, n = 6
MS_CSAT = {"csat_average": 7.67, "csat_response_count": 6}
# Approved non-empty answer_text rows: m1 {waiting, completion, greeted}=3 ; m2 {waiting, greeted}=2 ; m3 {comments, greeted}=2 ('' waiting excluded)
MS_TEXT_RESPONSES = 7
MS_VISITS = {"total": 7, "draft": 1, "pending": 1, "needs_changes": 1, "completed": 3, "approved": 3, "rejected": 1}
MS_WAITING = {"Under 5 min": 1, "5-10 min": 1}
MS_SERVICE = {"Same day": 1}
# Location CSAT: L1 = m1+m2 pooled [4,6,8,10] = 7.0 over 2 visits ; L2 = m3 [9,9] = 9.0 over 1 visit
MS_LOCATIONS = [("Anse Aux Pins", 2, 7.0), ("Victoria", 1, 9.0)]
# Staff: Ben 1 visit 9.0 ; Ana 2 visits 7.0 (ordered by CSAT desc)
MS_STAFF = [("Ben", 1, 9.0), ("Ana", 2, 7.0)]
MS_PURPOSES = {"Billing": 2, "Fault": 1}
