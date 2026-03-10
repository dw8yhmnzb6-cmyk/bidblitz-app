"""
Alembic Environment Configuration for BidBlitz
"""
import os
from pathlib import Path
from logging.config import fileConfig
from dotenv import load_dotenv

from sqlalchemy import pool
from sqlalchemy import create_engine

from alembic import context

# Load .env file
load_dotenv(Path(__file__).parent.parent / '.env')

# Import models to register with metadata
from pg_models import Base

# this is the Alembic Config object
config = context.config

# Get database URL from environment (sync version for Alembic)
DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL:
    # Ensure we use sync driver for Alembic
    sync_url = DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')
    config.set_main_option('sqlalchemy.url', sync_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Model metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_engine(
        config.get_main_option("sqlalchemy.url"),
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
