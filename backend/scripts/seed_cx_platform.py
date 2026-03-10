import sys
from datetime import datetime

from app.core.database import get_db
from app.core.models import User, Program, UserProgramRole
from app.core.assessment_models import AssessmentTemplate, Question
from app.programs.b2b.models import Business, AccountExecutive, B2BVisit


def seed_platform_data():
    """Seed the CX platform with core data."""
    db = next(get_db())
    
    try:
        # Create Programs (check if they exist first)
        programs_data = [
            {"code": "B2B", "name": "B2B CX Program", "description": "Business-to-Business Customer Experience Assessment"},
            {"code": "B2C", "name": "B2C CX Program", "description": "Business-to-Consumer Customer Experience Assessment"},
            {"code": "INSTALL", "name": "Installation CX Program", "description": "Installation Assessment Program"}
        ]
        
        created_programs = {}
        for program_data in programs_data:
            # Check if program already exists
            existing_program = db.query(Program).filter(Program.code == program_data["code"]).first()
            if existing_program:
                created_programs[program_data["code"]] = existing_program
                print(f"Program already exists: {existing_program.name}")
            else:
                program = Program(**program_data, is_active=True)
                db.add(program)
                db.flush()  # Get the ID without committing
                created_programs[program_data["code"]] = program
                print(f"Created program: {program.name}")
        
        # Create Users (check if they exist first)
        users_data = [
            {"email": "admin@cxplatform.com", "name": "System Administrator", "department": "IT"},
            {"email": "john.representative@cxplatform.com", "name": "John Representative", "department": "Sales"},
            {"email": "jane.manager@cxplatform.com", "name": "Jane Manager", "department": "Sales"},
            {"email": "bob.ae@cxplatform.com", "name": "Bob Account Executive", "department": "Sales"},
            {"email": "alice.technician@cxplatform.com", "name": "Alice Technician", "department": "Operations"}
        ]
        
        created_users = {}
        for user_data in users_data:
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == user_data["email"]).first()
            if existing_user:
                created_users[user_data["email"]] = existing_user
                print(f"User already exists: {existing_user.name}")
            else:
                user = User(**user_data, is_active=True)
                db.add(user)
                db.flush()
                created_users[user_data["email"]] = user
                print(f"Created user: {user.name}")
        
        # Create User Program Roles (check if they exist first)
        user_roles = [
            # Admin has access to all programs
            ("admin@cxplatform.com", "B2B", "Admin"),
            ("admin@cxplatform.com", "B2C", "Admin"),
            ("admin@cxplatform.com", "INSTALL", "Admin"),
            
            # B2B Program roles
            ("john.representative@cxplatform.com", "B2B", "Representative"),
            ("jane.manager@cxplatform.com", "B2B", "Manager"),
            ("bob.ae@cxplatform.com", "B2B", "Representative"),
            
            # B2C Program roles
            ("john.representative@cxplatform.com", "B2C", "Staff"),
            ("jane.manager@cxplatform.com", "B2C", "Manager"),
            
            # Installation Program roles
            ("alice.technician@cxplatform.com", "INSTALL", "Technician"),
            ("jane.manager@cxplatform.com", "INSTALL", "Manager"),
        ]
        
        for email, program_code, role in user_roles:
            # Check if role already exists
            user = db.query(User).filter(User.email == email).first()
            program = db.query(Program).filter(Program.code == program_code).first()
            
            existing_role = db.query(UserProgramRole).filter(
                UserProgramRole.user_id == user.id,
                UserProgramRole.program_id == program.id,
                UserProgramRole.role == role
            ).first()
            
            if existing_role:
                print(f"Role already exists: {email} - {program_code} - {role}")
            else:
                user_program_role = UserProgramRole(
                    user_id=created_users[email].id,
                    program_id=created_programs[program_code].id,
                    role=role
                )
                db.add(user_program_role)
                print(f"Created role: {email} - {program_code} - {role}")
        
        # Create B2B Assessment Template
        existing_template = db.query(AssessmentTemplate).filter(
            AssessmentTemplate.program_id == created_programs["B2B"].id,
            AssessmentTemplate.version == "1.0"
        ).first()
        
        if not existing_template:
            b2b_template = AssessmentTemplate(
                program_id=created_programs["B2B"].id,
                name="B2B Customer Experience Assessment",
                description="Standard B2B CX assessment questionnaire",
                version="1.0",
                is_active=True
            )
            db.add(b2b_template)
            db.flush()
            print(f"Created B2B assessment template: {b2b_template.name}")
            
            # Create B2B Questions
            b2b_questions = [
                {
                    "question_key": "relationship_strength",
                    "question_text": "Rate your relationship with our company.",
                    "input_type": "score",
                    "score_min": 0,
                    "score_max": 10,
                    "is_mandatory": True,
                    "order_index": 1,
                    "category": "Relationship"
                },
                {
                    "question_key": "ae_professionalism",
                    "question_text": "How would you rate the professionalism of your Account Executive?",
                    "input_type": "score",
                    "score_min": 0,
                    "score_max": 10,
                    "is_mandatory": True,
                    "order_index": 2,
                    "category": "Account Executive"
                },
                {
                    "question_key": "service_quality",
                    "question_text": "How satisfied are you with our service quality?",
                    "input_type": "score",
                    "score_min": 0,
                    "score_max": 10,
                    "is_mandatory": True,
                    "order_index": 3,
                    "category": "Service"
                },
                {
                    "question_key": "would_recommend",
                    "question_text": "Would you recommend our company to others?",
                    "input_type": "yes_no",
                    "is_mandatory": True,
                    "order_index": 4,
                    "category": "Recommendation"
                }
            ]
            
            for question_data in b2b_questions:
                question = Question(
                    template_id=b2b_template.id,
                    **question_data
                )
                db.add(question)
            
            print(f"Created {len(b2b_questions)} B2B questions")
        else:
            print(f"B2B assessment template already exists")
        
        # Create B2B Account Executives (check if they exist first)
        ae_data = [
            {"name": "John Smith", "email": "john.smith@company.com", "phone": "+1-555-0101"},
            {"name": "Sarah Johnson", "email": "sarah.johnson@company.com", "phone": "+1-555-0102"},
            {"name": "Mike Wilson", "email": "mike.wilson@company.com", "phone": "+1-555-0103"}
        ]
        
        for ae_info in ae_data:
            existing_ae = db.query(AccountExecutive).filter(AccountExecutive.email == ae_info["email"]).first()
            if existing_ae:
                print(f"Account Executive already exists: {existing_ae.name}")
            else:
                ae = AccountExecutive(**ae_info, active=True)
                db.add(ae)
                print(f"Created Account Executive: {ae.name}")
        
        # Create B2B Businesses (check if they exist first)
        business_data = [
            {"name": "Tech Solutions Inc.", "location": "New York, NY", "priority_level": "high"},
            {"name": "Global Corp", "location": "San Francisco, CA", "priority_level": "medium"},
            {"name": "Innovation Labs", "location": "Austin, TX", "priority_level": "high"},
            {"name": "Enterprise Systems", "location": "Chicago, IL", "priority_level": "low"}
        ]
        
        for biz_info in business_data:
            existing_business = db.query(Business).filter(Business.name == biz_info["name"]).first()
            if existing_business:
                print(f"Business already exists: {existing_business.name}")
            else:
                business = Business(**biz_info, active=True)
                db.add(business)
                print(f"Created Business: {business.name}")
        
        # Create B2B Visits (check if they exist first)
        visit_data = [
            {"business_name": "Tech Solutions Inc.", "visit_date": "2024-01-15", "visit_type": "Quarterly Review", "status": "completed"},
            {"business_name": "Global Corp", "visit_date": "2024-01-20", "visit_type": "Check-in", "status": "scheduled"},
            {"business_name": "Innovation Labs", "visit_date": "2024-01-25", "visit_type": "Product Demo", "status": "draft"}
        ]
        
        for visit_info in visit_data:
            # Find the business
            business = db.query(Business).filter(Business.name == visit_info["business_name"]).first()
            if business:
                # Check if visit already exists
                existing_visit = db.query(B2BVisit).filter(
                    B2BVisit.business_id == business.id,
                    B2BVisit.visit_date == visit_info["visit_date"]
                ).first()
                
                if existing_visit:
                    print(f"Visit already exists: {business.name} on {visit_info['visit_date']}")
                else:
                    visit = B2BVisit(
                        business_id=business.id,
                        representative_id=1,  # Default to first user
                        visit_date=visit_info["visit_date"],
                        visit_type=visit_info["visit_type"],
                        status=visit_info["status"]
                    )
                    db.add(visit)
                    print(f"Created Visit: {business.name} on {visit_info['visit_date']}")
        
        db.commit()
        print("\n🎉 CX Platform data seeding completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data: {e}")
        raise
    finally:
        db.close()


def get_b2b_questions():
    """Get B2B assessment questions."""
    return [
        {
            "text": "Rate your relationship with C&W.",
            "category": "Category 1: Relationship Strength",
            "question_type": "score",
            "order_index": 1,
            "is_required": True,
            "validation_rules_json": {"min": 0, "max": 10}
        },
        {
            "text": "Do you get enough information from your Account Executive on New Products and Services?",
            "category": "Category 1: Relationship Strength",
            "question_type": "score",
            "order_index": 2,
            "is_required": True,
            "validation_rules_json": {"min": 0, "max": 10}
        },
        {
            "text": "How would you rate the level of professionalism when dealing with your C&W Account Executive?",
            "category": "Category 1: Relationship Strength",
            "question_type": "score",
            "order_index": 3,
            "is_required": True,
            "validation_rules_json": {"min": 0, "max": 10}
        },
        {
            "text": "Does the C&W Account Executive understand your business?",
            "category": "Category 1: Relationship Strength",
            "question_type": "boolean",
            "order_index": 4,
            "is_required": True,
            "helper_text": "Select Yes or No"
        },
        {
            "text": "How satisfied are you with your C&W contacts and number of visits?",
            "category": "Category 1: Relationship Strength",
            "question_type": "score",
            "order_index": 5,
            "is_required": True,
            "validation_rules_json": {"min": 0, "max": 10}
        },
        {
            "text": "How do you rate the quality of products and services provided by C&W?",
            "category": "Category 2: Service Performance",
            "question_type": "score",
            "order_index": 6,
            "is_required": True,
            "validation_rules_json": {"min": 0, "max": 10}
        },
        {
            "text": "How would you rate C&W's delivery performance?",
            "category": "Category 2: Service Performance",
            "question_type": "score",
            "order_index": 7,
            "is_required": True,
            "validation_rules_json": {"min": 0, "max": 10}
        },
        {
            "text": "How satisfied are you with the technical support provided by C&W?",
            "category": "Category 2: Service Performance",
            "question_type": "score",
            "order_index": 8,
            "is_required": True,
            "validation_rules_json": {"min": 0, "max": 10}
        },
        {
            "text": "Rate the overall value for money of C&W's products and services.",
            "category": "Category 3: Commercial Aspects",
            "question_type": "score",
            "order_index": 9,
            "is_required": True,
            "validation_rules_json": {"min": 0, "max": 10}
        },
        {
            "text": "How competitive are C&W's prices compared to the market?",
            "category": "Category 3: Commercial Aspects",
            "question_type": "score",
            "order_index": 10,
            "is_required": True,
            "validation_rules_json": {"min": 0, "max": 10}
        }
    ]


if __name__ == "__main__":
    print("🌱 Seeding CX Platform data...")
    seed_platform_data()
