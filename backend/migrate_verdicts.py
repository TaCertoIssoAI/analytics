import os
import sys
from google.cloud import firestore
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def migrate_verdicts():
    """
    Migrates existing analyses in Firestore to use the new verdict terminology.
    Updates "UNVERIFIED", "CHECK", "DESCONHECIDO", "Não Verificável" to "Fontes insuficientes para verificar".
    """
    project_id = os.getenv("PROJECT_ID", "sitegrupysanca")
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if not project_id:
        print("❌ PROJECT_ID not found in environment variables.")
        return

    print(f"Starting migration for project: {project_id}")
    
    try:
        # Initialize Firestore client
        db = firestore.Client(project=project_id, database='tacertoissoai')
        collection_ref = db.collection("analises")
        
        # Get all documents
        docs = collection_ref.stream()
        
        updated_count = 0
        processed_count = 0
        
        old_verdicts = ["UNVERIFIED", "CHECK", "DESCONHECIDO", "Não Verificável"]
        new_verdict = "Fontes insuficientes para verificar"
        
        for doc in docs:
            processed_count += 1
            data = doc.to_dict()
            current_verdict = data.get("overall_verdict")
            
            if current_verdict in old_verdicts:
                print(f"Updating document {doc.id}: {current_verdict} -> {new_verdict}")
                doc.reference.update({"overall_verdict": new_verdict})
                updated_count += 1
                
        print(f"\nMigration completed!")
        print(f"Processed documents: {processed_count}")
        print(f"Updated documents: {updated_count}")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")

if __name__ == "__main__":
    migrate_verdicts()
