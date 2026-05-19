import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import dotenv_values

#build absolute path to .env file and load it into memory
BASE_DIR = Path(__file__).resolve().parent.parent
env_path = os.path.join(BASE_DIR, ".env")
env_config = dotenv_values(env_path)

#get the database 
SQLALCHEMY_DATABASE_URL = env_config.get("DATABASE_URL") or os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URL:
    raise ValueError(f"\n🛑 CRITICAL ERROR: DATABASE_URL is missing!\nPython looked for your .env file exactly here: {env_path}\nPlease ensure the file exists at that exact path and contains 'DATABASE_URL=...'\n")
#engine is the actual connection to the database
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300
)

#temporary session factory for creating database sessions
session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

#use the Base class that User model inherits from to create the database tables
Base = declarative_base()
#safly open and close the database using this function
def get_db():
    db = session_local()
    try:
        yield db
    finally:
        db.close()
