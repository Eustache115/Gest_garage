import os
import sys

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database import engine

def update():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE avis ADD COLUMN IF NOT EXISTS id_intervention INTEGER;"))
            try:
                conn.execute(text("ALTER TABLE avis ADD CONSTRAINT fk_avis_interv FOREIGN KEY (id_intervention) REFERENCES interventions (id_intervention) ON DELETE CASCADE;"))
            except ProgrammingError as e:
                # Might already exist
                pass
            conn.commit()
            print("DB updated successfully")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update()
