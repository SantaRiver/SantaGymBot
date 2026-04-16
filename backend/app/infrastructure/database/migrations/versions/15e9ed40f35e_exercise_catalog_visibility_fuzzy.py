"""exercise_catalog_visibility_fuzzy

Revision ID: 15e9ed40f35e
Revises: 0a6ff7377d2a
Create Date: 2026-04-16 10:37:02.133627

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '15e9ed40f35e'
down_revision: Union[str, None] = '0a6ff7377d2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable trigram extension for fuzzy similarity search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Add visibility: 'system' for seeded exercises, 'private' for user-created
    op.add_column('exercises',
        sa.Column('visibility', sa.String(length=20), nullable=False,
                  server_default='system')
    )

    # Add normalized name column (nullable initially, backfilled below, then NOT NULL)
    op.add_column('exercises',
        sa.Column('name_normalized', sa.Text(), nullable=True)
    )

    # Add canonical_id: nullable self-referential FK for future dedup linking (no logic yet)
    op.add_column('exercises',
        sa.Column('canonical_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_exercises_canonical_id',
        'exercises', 'exercises',
        ['canonical_id'], ['id'],
        ondelete='SET NULL'
    )

    # Backfill visibility from user_id
    op.execute("UPDATE exercises SET visibility = 'system' WHERE user_id IS NULL")
    op.execute("UPDATE exercises SET visibility = 'private' WHERE user_id IS NOT NULL")

    # Backfill normalized names: lowercase, collapse whitespace, strip
    op.execute(r"""
        UPDATE exercises
        SET name_normalized = lower(trim(regexp_replace(name, '\s+', ' ', 'g')))
    """)

    # Now enforce NOT NULL on name_normalized
    op.alter_column('exercises', 'name_normalized', nullable=False)

    # GIN trigram index — correct choice for read-heavy similarity search (faster lookups than GiST)
    op.execute("""
        CREATE INDEX ix_exercises_name_normalized_trgm
        ON exercises
        USING gin (name_normalized gin_trgm_ops)
    """)

    # B-tree index for visibility filtering
    op.create_index('ix_exercises_visibility', 'exercises', ['visibility'])


def downgrade() -> None:
    op.drop_index('ix_exercises_visibility', table_name='exercises')
    op.execute("DROP INDEX IF EXISTS ix_exercises_name_normalized_trgm")
    op.drop_constraint('fk_exercises_canonical_id', 'exercises', type_='foreignkey')
    op.drop_column('exercises', 'canonical_id')
    op.drop_column('exercises', 'name_normalized')
    op.drop_column('exercises', 'visibility')
