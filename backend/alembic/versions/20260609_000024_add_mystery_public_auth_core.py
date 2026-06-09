"""add mystery public auth core tables

Revision ID: 20260609_000024
Revises: 20260528_000023
Create Date: 2026-06-09 00:00:24
"""

from alembic import op
import sqlalchemy as sa


revision = "20260609_000024"
down_revision = "20260528_000023"
branch_labels = None
depends_on = None


def _has_table(bind, name: str) -> bool:
    return bool(
        bind.execute(
            sa.text("SELECT 1 FROM information_schema.tables WHERE table_name = :name LIMIT 1"),
            {"name": name},
        ).scalar()
    )


def _has_index(bind, table_name: str, index_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                """
                SELECT 1
                FROM pg_indexes
                WHERE tablename = :table_name AND indexname = :index_name
                LIMIT 1
                """
            ),
            {"table_name": table_name, "index_name": index_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_table(bind, "mystery_users"):
        op.create_table(
            "mystery_users",
            sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
            sa.Column("email", sa.String(length=320), nullable=False, unique=True),
            sa.Column("full_name", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.Text(), nullable=True),
            sa.Column("password_set_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("totp_secret_enc", sa.Text(), nullable=True),
            sa.Column("totp_confirmed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="invited"),
            sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("failed_mfa_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_totp_step", sa.BigInteger(), nullable=True),
            sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.String(length=320), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        )

    if not _has_table(bind, "mystery_sessions"):
        op.create_table(
            "mystery_sessions",
            sa.Column("session_id", sa.String(length=128), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("mystery_users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("idle_expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ip", sa.String(length=64), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
        )

    if not _has_table(bind, "mystery_recovery_codes"):
        op.create_table(
            "mystery_recovery_codes",
            sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("mystery_users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("code_hash", sa.Text(), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        )

    if not _has_table(bind, "mystery_enrollment_tokens"):
        op.create_table(
            "mystery_enrollment_tokens",
            sa.Column("token_hash", sa.String(length=64), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("mystery_users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("purpose", sa.String(length=20), nullable=False, server_default="enroll"),
            sa.Column("pending_totp_secret_enc", sa.Text(), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        )

    if not _has_table(bind, "mystery_mfa_challenges"):
        op.create_table(
            "mystery_mfa_challenges",
            sa.Column("challenge_id", sa.String(length=128), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("mystery_users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ip", sa.String(length=64), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
        )

    if not _has_table(bind, "mystery_auth_audit"):
        op.create_table(
            "mystery_auth_audit",
            sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=True),
            sa.Column("email", sa.String(length=320), nullable=True),
            sa.Column("event_type", sa.String(length=40), nullable=False),
            sa.Column("ip", sa.String(length=64), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        )

    if not _has_index(bind, "mystery_users", "ix_mystery_users_email_lower"):
        op.execute("CREATE UNIQUE INDEX ix_mystery_users_email_lower ON mystery_users (lower(email))")
    if not _has_index(bind, "mystery_sessions", "ix_mystery_sessions_user_id"):
        op.create_index("ix_mystery_sessions_user_id", "mystery_sessions", ["user_id"], unique=False)
    if not _has_index(bind, "mystery_sessions", "ix_mystery_sessions_idle_expires_at"):
        op.create_index("ix_mystery_sessions_idle_expires_at", "mystery_sessions", ["idle_expires_at"], unique=False)
    if not _has_index(bind, "mystery_mfa_challenges", "ix_mystery_mfa_challenges_user_id"):
        op.create_index("ix_mystery_mfa_challenges_user_id", "mystery_mfa_challenges", ["user_id"], unique=False)
    if not _has_index(bind, "mystery_recovery_codes", "ix_mystery_recovery_codes_user_id"):
        op.create_index("ix_mystery_recovery_codes_user_id", "mystery_recovery_codes", ["user_id"], unique=False)
    if not _has_index(bind, "mystery_enrollment_tokens", "ix_mystery_enrollment_tokens_user_id"):
        op.create_index("ix_mystery_enrollment_tokens_user_id", "mystery_enrollment_tokens", ["user_id"], unique=False)
    if not _has_index(bind, "mystery_enrollment_tokens", "ix_mystery_enrollment_tokens_expires_at"):
        op.create_index("ix_mystery_enrollment_tokens_expires_at", "mystery_enrollment_tokens", ["expires_at"], unique=False)
    if not _has_index(bind, "mystery_auth_audit", "ix_mystery_auth_audit_created_at"):
        op.create_index("ix_mystery_auth_audit_created_at", "mystery_auth_audit", ["created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name, index_name in [
        ("mystery_auth_audit", "ix_mystery_auth_audit_created_at"),
        ("mystery_enrollment_tokens", "ix_mystery_enrollment_tokens_expires_at"),
        ("mystery_enrollment_tokens", "ix_mystery_enrollment_tokens_user_id"),
        ("mystery_recovery_codes", "ix_mystery_recovery_codes_user_id"),
        ("mystery_mfa_challenges", "ix_mystery_mfa_challenges_user_id"),
        ("mystery_sessions", "ix_mystery_sessions_idle_expires_at"),
        ("mystery_sessions", "ix_mystery_sessions_user_id"),
    ]:
        if _has_table(bind, table_name) and _has_index(bind, table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    if _has_table(bind, "mystery_users") and _has_index(bind, "mystery_users", "ix_mystery_users_email_lower"):
        op.execute("DROP INDEX ix_mystery_users_email_lower")

    for table_name in ["mystery_auth_audit", "mystery_enrollment_tokens", "mystery_recovery_codes", "mystery_mfa_challenges", "mystery_sessions", "mystery_users"]:
        if _has_table(bind, table_name):
            op.drop_table(table_name)
