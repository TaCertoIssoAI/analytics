#!/usr/bin/env python

import copy
import os
import google.auth
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = "sitegrupysanca"
DATASET_ID = "analytics_whatsapp_br"
TABLE_ID = os.getenv("BIGQUERY_TABLE")

# RECORD field that holds the nested columns
PARENT_FIELD_NAME = "media_info"

# Nested fields to add inside media_info
NEW_FIELDS = [
    {
        "name": "video_uri",
        "type": "STRING",
        "mode": "NULLABLE",
        "description": "URI for the extracted video",
    }
]


def add_nested_fields_via_patch(
    project_id: str,
    dataset_id: str,
    table_id: str,
    parent_field_name: str,
    new_fields: list[dict],
) -> None:
    # Use Application Default Credentials
    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/bigquery"])
    service = build("bigquery", "v2", credentials=creds)

    # 1) Get current table metadata
    table = (
        service.tables()
        .get(projectId=project_id, datasetId=dataset_id, tableId=table_id)
        .execute()
    )

    schema_fields = table.get("schema", {}).get("fields", [])
    updated_fields = copy.deepcopy(schema_fields)

    # 2) Find the parent RECORD field (media_info)
    parent = None
    for field in updated_fields:
        if field.get("name") == parent_field_name:
            parent = field
            break

    if parent is None:
        raise ValueError(f"Parent field {parent_field_name!r} not found in schema")

    if parent.get("type") != "RECORD":
        raise ValueError(f"Field {parent_field_name!r} is not a RECORD")

    parent.setdefault("fields", [])

    # 3) Add new nested fields if they are not already there
    existing_names = {f["name"] for f in parent["fields"]}
    for nf in new_fields:
        if nf["name"] in existing_names:
            print(f"Nested field {nf['name']} already exists, skipping")
        else:
            parent["fields"].append(nf)
            print(f"Added nested field {nf['name']} to {parent_field_name}")

    # 4) Patch the table with the updated schema
    patch_body = {"schema": {"fields": updated_fields}}

    result = (
        service.tables()
        .patch(
            projectId=project_id,
            datasetId=dataset_id,
            tableId=table_id,
            body=patch_body,
        )
        .execute()
    )

    print("Patch applied. New schema:")
    print(result["schema"])


if __name__ == "__main__":
    add_nested_fields_via_patch(
        PROJECT_ID,
        DATASET_ID,
        TABLE_ID,
        PARENT_FIELD_NAME,
        NEW_FIELDS,
    )
