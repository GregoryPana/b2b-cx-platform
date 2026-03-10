"""Create unified CX platform structure

Revision ID: d01c3a366199
Revises: 20260227_000009
Create Date: 2026-03-02 15:48:56.048519

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd01c3a366199'
down_revision = '20260227_000009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create core platform tables
    op.create_table('programs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_programs_code'), 'programs', ['code'], unique=True)
    op.create_index(op.f('ix_programs_id'), 'programs', ['id'], unique=False)

    op.create_table('user_program_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_program_roles_program_id', 'user_program_roles', ['program_id'], unique=False)
    op.create_index('ix_user_program_roles_user_id', 'user_program_roles', ['user_id'], unique=False)

    # Create assessment framework tables
    op.create_table('assessment_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('version', sa.String(length=20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_assessment_templates_program_id', 'assessment_templates', ['program_id'], unique=False)

    op.create_table('file_attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('uploaded_by', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('questions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('text', sa.String(length=2000), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('question_type', sa.String(length=50), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('is_required', sa.Boolean(), nullable=False),
        sa.Column('conditional_logic_json', sa.JSON(), nullable=True),
        sa.Column('validation_rules_json', sa.JSON(), nullable=True),
        sa.Column('helper_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['assessment_templates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_questions_category', 'questions', ['category'], unique=False)
    op.create_index('ix_questions_template_id', 'questions', ['template_id'], unique=False)

    op.create_table('assessment_instances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=False),
        sa.Column('template_version', sa.String(length=20), nullable=False),
        sa.Column('respondent_id', sa.Integer(), nullable=False),
        sa.Column('context_id', sa.Integer(), nullable=False),
        sa.Column('context_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('submitted_by', sa.Integer(), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ),
        sa.ForeignKeyConstraint(['respondent_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_assessment_instances_context_id', 'assessment_instances', ['context_id'], unique=False)
    op.create_index('ix_assessment_instances_program_id', 'assessment_instances', ['program_id'], unique=False)
    op.create_index('ix_assessment_instances_respondent_id', 'assessment_instances', ['respondent_id'], unique=False)

    op.create_table('responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('assessment_id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('score_value', sa.Integer(), nullable=True),
        sa.Column('text_value', sa.Text(), nullable=True),
        sa.Column('boolean_value', sa.Boolean(), nullable=True),
        sa.Column('file_attachment_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['assessment_id'], ['assessment_instances.id'], ),
        sa.ForeignKeyConstraint(['file_attachment_id'], ['file_attachments.id'], ),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_responses_assessment_id', 'responses', ['assessment_id'], unique=False)
    op.create_index('ix_responses_question_id', 'responses', ['question_id'], unique=False)

    # Create B2B-specific tables
    op.create_table('b2b_account_executives',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_b2b_account_executives_email'), 'b2b_account_executives', ['email'], unique=True)

    op.create_table('b2b_businesses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('account_executive_id', sa.Integer(), nullable=True),
        sa.Column('priority_level', sa.String(length=20), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['account_executive_id'], ['b2b_account_executives.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('b2b_visits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('representative_id', sa.Integer(), nullable=False),
        sa.Column('visit_date', sa.String(length=50), nullable=False),
        sa.Column('visit_type', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('assessment_instance_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['assessment_instance_id'], ['assessment_instances.id'], ),
        sa.ForeignKeyConstraint(['business_id'], ['b2b_businesses.id'], ),
        sa.ForeignKeyConstraint(['representative_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_b2b_visits_business_id', 'b2b_visits', ['business_id'], unique=False)
    op.create_index('ix_b2b_visits_representative_id', 'b2b_visits', ['representative_id'], unique=False)


def downgrade() -> None:
    # Drop B2B tables
    op.drop_index('ix_b2b_visits_representative_id', table_name='b2b_visits')
    op.drop_index('ix_b2b_visits_business_id', table_name='b2b_visits')
    op.drop_table('b2b_visits')
    op.drop_table('b2b_businesses')
    op.drop_index(op.f('ix_b2b_account_executives_email'), table_name='b2b_account_executives')
    op.drop_table('b2b_account_executives')

    # Drop assessment framework tables
    op.drop_index('ix_responses_question_id', table_name='responses')
    op.drop_index('ix_responses_assessment_id', table_name='responses')
    op.drop_table('responses')
    op.drop_index('ix_assessment_instances_respondent_id', table_name='assessment_instances')
    op.drop_index('ix_assessment_instances_program_id', table_name='assessment_instances')
    op.drop_index('ix_assessment_instances_context_id', table_name='assessment_instances')
    op.drop_table('assessment_instances')
    op.drop_index('ix_questions_template_id', table_name='questions')
    op.drop_index('ix_questions_category', table_name='questions')
    op.drop_table('questions')
    op.drop_table('file_attachments')
    op.drop_index('ix_assessment_templates_program_id', table_name='assessment_templates')
    op.drop_table('assessment_templates')

    # Drop core platform tables
    op.drop_index('ix_user_program_roles_user_id', table_name='user_program_roles')
    op.drop_index('ix_user_program_roles_program_id', table_name='user_program_roles')
    op.drop_table('user_program_roles')
    op.drop_index(op.f('ix_programs_id'), table_name='programs')
    op.drop_index(op.f('ix_programs_code'), table_name='programs')
    op.drop_table('programs')
