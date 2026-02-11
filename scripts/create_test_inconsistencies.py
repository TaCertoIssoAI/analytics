import os
import sys
from datetime import datetime

# Add backend directory to sys.path to allow imports
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend'))
sys.path.append(backend_path)

from app.services.firestore_service import firestore_service
from app.services.bigquery_service import bigquery_service
from app.models.new_format import AnaliseNewFormat

def create_inconsistencies():
    print("Creating inconsistencies...")

    # 1. Missing in BigQuery (Exists in Firestore)
    doc_id_fs = "TEST_MISSING_IN_BQ_" + datetime.now().strftime("%Y%m%d%H%M%S")
    analise_fs = AnaliseNewFormat(
        document_id=doc_id_fs,
        user_message_text="Test Inconsistency - Missing in BQ",
        processed_at=datetime.now(),
        overall_verdict="TEST",
        claims=[],
        analysis_metrics={}
    )
    if firestore_service.save_analise(analise_fs):
        print(f"✅ Created {doc_id_fs} in Firestore (Missing in BQ)")
    else:
        print(f"❌ Failed to create {doc_id_fs} in Firestore")

    # 2. Missing in Firestore (Exists in BigQuery)
    doc_id_bq = "TEST_MISSING_IN_FS_" + datetime.now().strftime("%Y%m%d%H%M%S")
    analise_bq = AnaliseNewFormat(
        document_id=doc_id_bq,
        user_message_text="Test Inconsistency - Missing in FS",
        processed_at=datetime.now(),
        overall_verdict="TEST",
        claims=[],
        analysis_metrics={}
    )
    if bigquery_service.insert_analise(analise_bq):
        print(f"✅ Created {doc_id_bq} in BigQuery (Missing in FS)")
    else:
        print(f"❌ Failed to create {doc_id_bq} in BigQuery")

if __name__ == "__main__":
    create_inconsistencies()
