import tempfile
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.core.config import settings

dev_url = make_url(settings.database_url)
test_url = dev_url.set(database=f"{dev_url.database}_test")

admin = create_engine(dev_url, isolation_level="AUTOCOMMIT")
with admin.connect() as conn:
    if not conn.scalar(text("select 1 from pg_database where datname = :name"), {"name": test_url.database}):
        conn.execute(text(f'create database "{test_url.database}"'))
admin.dispose()

settings.database_url = test_url.render_as_string(hide_password=False)
settings.uploads_dir = Path(tempfile.mkdtemp())
command.upgrade(Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head")
