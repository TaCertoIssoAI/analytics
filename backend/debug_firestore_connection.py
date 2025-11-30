import os
import sys
from datetime import datetime

# Add current directory to path to allow imports
sys.path.append(os.getcwd())

from app.config import settings
from app.services.firestore_service import firestore_service
from app.models.new_format import AnaliseNewFormat, MediaInfo, AnalysisMetrics

def debug_firestore():
    print("🔍 Testing Firestore Connection...")
    print(f"Project ID: {settings.PROJECT_ID}")
    
    if not firestore_service.client:
        print("❌ Firestore client is NOT initialized.")
        return

    print("✅ Firestore client initialized.")

    # Create a dummy analysis
    dummy_analise = AnaliseNewFormat(
        document_id="debug_test_" + datetime.now().strftime("%Y%m%d%H%M%S"),
        processed_at=datetime.now().isoformat(),
        source_type="FromDirectMessage",
        user_message_text="Debug test message",
        overall_verdict="CHECK",
        final_comment="Debug comment",
        media_info=MediaInfo(),
        analysis_metrics=AnalysisMetrics()
    )

    print(f"📝 Attempting to save document: {dummy_analise.document_id}")
    
    success = firestore_service.save_analise(dummy_analise)
    
    if success:
        print("✅ Save operation returned True.")
        
        # Try to read it back
        print("📖 Attempting to read back...")
        saved_doc = firestore_service.get_analise(dummy_analise.document_id)
        
        if saved_doc:
            print("✅ Document retrieved successfully!")
            print(f"ID: {saved_doc.get('document_id')}")
        else:
            print("❌ Document NOT found after saving.")
    else:
        print("❌ Save operation returned False.")

if __name__ == "__main__":
    debug_firestore()
