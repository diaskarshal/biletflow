from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=2, max_overflow=1)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
