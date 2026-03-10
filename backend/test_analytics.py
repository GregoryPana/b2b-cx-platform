#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def test_analytics():
    try:
        engine = create_engine('postgresql://b2b:b2b@localhost:5432/b2b')
        Session = sessionmaker(bind=engine)
        db = Session()
        
        print("Testing visit stats...")
        visit_stats = db.execute(text("""
            SELECT 
                COUNT(*) as total_visits,
                SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft_visits,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_visits,
                SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved_visits,
                SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected_visits
            FROM visits
        """)).fetchone()
        
        print(f"Visit stats: {visit_stats}")
        
        print("Testing NPS stats...")
        nps_stats = db.execute(text("""
            SELECT 
                SUM(CASE WHEN r.score >= 9 THEN 1 ELSE 0 END) as promoters,
                SUM(CASE WHEN r.score <= 6 THEN 1 ELSE 0 END) as detractors,
                SUM(CASE WHEN r.score >= 7 AND r.score <= 8 THEN 1 ELSE 0 END) as passives,
                COUNT(r.score) as total_responses
            FROM b2b_visit_responses r
            JOIN questions q ON r.question_id = q.id
            JOIN visits v ON r.visit_id = v.id
            WHERE q.is_nps = true 
            AND v.status = 'Approved'
            AND r.score IS NOT NULL
        """)).fetchone()
        
        print(f"NPS stats: {nps_stats}")
        
        print("Testing satisfaction stats...")
        satisfaction_stats = db.execute(text("""
            SELECT 
                AVG(CASE WHEN q.question_number = 12 AND r.score IS NOT NULL THEN r.score ELSE NULL END) as avg_satisfaction,
                COUNT(CASE WHEN q.question_number = 12 AND r.score IS NOT NULL THEN 1 ELSE 0 END) as satisfaction_responses
            FROM b2b_visit_responses r
            JOIN questions q ON r.question_id = q.id
            JOIN visits v ON r.visit_id = v.id
            WHERE v.status = 'Approved'
            AND q.question_number = 12
            AND r.score IS NOT NULL
        """)).fetchone()
        
        print(f"Satisfaction stats: {satisfaction_stats}")
        
        result = {
            "visits": {
                "total": visit_stats.total_visits,
                "draft": visit_stats.draft_visits,
                "pending": visit_stats.pending_visits,
                "completed": visit_stats.approved_visits,
                "approved": visit_stats.approved_visits,
                "rejected": visit_stats.rejected_visits
            },
            "responses": {
                "text_responses": satisfaction_stats.satisfaction_responses
            },
            "nps": {
                "promoters": int(nps_stats.promoters),
                "detractors": int(nps_stats.detractors),
                "passives": int(nps_stats.passives),
                "total_responses": int(nps_stats.total_responses),
            }
        }
        
        print("SUCCESS: Analytics working!")
        print(result)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return {"detail": str(e)}

if __name__ == "__main__":
    test_analytics()
