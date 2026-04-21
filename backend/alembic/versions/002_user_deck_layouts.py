"""Add user_deck_layouts table

Revision ID: 002_user_deck_layouts
Revises: 001_initial_auth
Create Date: 2026-04-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '002_user_deck_layouts'
down_revision = '001_initial_auth'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_deck_layouts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('configuration', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('validation_status', sa.String(length=20), nullable=False, server_default='unvalidated'),
        sa.Column('validation_feedback', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='manual'),
        sa.Column('source_filename', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_deck_layouts_user_id', 'user_deck_layouts', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_user_deck_layouts_user_id', table_name='user_deck_layouts')
    op.drop_table('user_deck_layouts')
