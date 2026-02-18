
import os
import sys

# Add backend to path so we can import app.config
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.config import settings

def verify():
    # Only print relevant info
    print(f"FIRESTORE_ANALISES={settings.FIRESTORE_ANALISES}")

if __name__ == "__main__":
    verify()
