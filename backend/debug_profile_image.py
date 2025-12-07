import sys
import os
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.abspath("/home/lfelipediniz/Desktop/analytics/backend"))

from app.services.firestore_service import firestore_service

def test_profile_image_persistence():
    uid = "test_user_debug_image"
    
    # 1. Create profile with image
    profile_data = {
        "uid": uid,
        "email": "test@example.com",
        "displayName": "Test User",
        "createdAt": int(datetime.now().timestamp() * 1000),
        "photoURL": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AP/2Q==", # Tiny base64 jpeg
        "bio": "Test Bio",
        "occupation": "Tester"
    }
    
    print(f"Saving profile for {uid}...")
    success = firestore_service.create_user_profile(profile_data)
    
    if not success:
        print("❌ Failed to save profile")
        return

    print("✅ Profile saved.")

    # 2. Retrieve profile
    print(f"Retrieving profile for {uid}...")
    retrieved_profile = firestore_service.get_user_profile(uid)
    
    if not retrieved_profile:
        print("❌ Failed to retrieve profile")
        return
        
    print("Retrieved profile data:")
    print(retrieved_profile)
    
    # 3. Verify photoURL
    if retrieved_profile.get("photoURL") == profile_data["photoURL"]:
        print("✅ photoURL matches!")
    else:
        print("❌ photoURL mismatch or missing!")
        print(f"Expected: {profile_data['photoURL']}")
        print(f"Got: {retrieved_profile.get('photoURL')}")

if __name__ == "__main__":
    test_profile_image_persistence()
