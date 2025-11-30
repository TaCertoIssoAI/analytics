from app.services.bigquery_service import bigquery_service

def debug_list():
    # Simulate default filters from router
    filters = {
        "search": None,
        "message_type_whatsapp": True,
        "message_type_direct": True,
        "modality_text": True,
        "modality_audio": True,
        "modality_video": True,
        "modality_image": True,
        "result_fake": True,
        "result_true": True,
        "result_unknown": True,
        "min_truth_score": 0,
        "max_truth_score": 100,
        "min_fake_score": 0,
        "max_fake_score": 100,
    }
    
    print("Calling list_analises with default filters...")
    result = bigquery_service.list_analises(limit=10, offset=0, filters=filters)
    
    if result:
        print(f"Result items count: {len(result['items'])}")
        import json
        print(json.dumps(result['items'][0], indent=2, default=str))
    else:
        print("Result is None")

if __name__ == "__main__":
    debug_list()
