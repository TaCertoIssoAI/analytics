import os
from google.cloud import bigquery
from app.config import settings

# Setup credentials
if settings.GOOGLE_APPLICATION_CREDENTIALS:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS

def check_source_types():
    client = bigquery.Client(project=settings.PROJECT_ID)
    full_table_id = f"{settings.PROJECT_ID}.{settings.DATASET_ID}.{settings.TABLE_ID}"
    
    print(f"Querying table: {full_table_id}")
    
    query = f"""
        SELECT *
        FROM `{full_table_id}`
        LIMIT 1
    """
    
    try:
        query_job = client.query(query)
        results = list(query_job.result())
        
        print("\nRecord content:")
        for row in results:
            data = dict(row.items())
            print(f"Document ID: {data.get('document_id')}")
            print(f"Source Type: {data.get('source_type')}")
            print(f"User Message Text: '{data.get('user_message_text')}'")
            print(f"Media Info: {data.get('media_info')}")
            print(f"Analysis Metrics: {data.get('analysis_metrics')}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_source_types()
