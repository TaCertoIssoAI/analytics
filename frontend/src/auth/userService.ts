import { User } from "firebase/auth";

const API_URL = "http://localhost:8000";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: number;
  photoURL?: string;
  bio?: string;
  occupation?: string;
  socials?: {
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  };
}

/**
 * Create or update a user profile via Backend API
 */
export const createUserProfile = async (user: User) => {
  const newProfile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL || undefined,
    createdAt: Date.now(),
  };

  try {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newProfile),
    });

    if (!response.ok) {
      throw new Error(`Failed to create profile: ${response.statusText}`);
    }
    console.log("Profile created via API");
  } catch (error) {
    console.error("Error creating user profile:", error);
  }
};

/**
 * Save full user profile via Backend API
 */
export const saveUserProfile = async (profile: UserProfile) => {
  try {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profile),
    });

    if (!response.ok) {
      throw new Error(`Failed to save profile: ${response.statusText}`);
    }
    console.log("Profile saved via API");
    return true;
  } catch (error) {
    console.error("Error saving user profile:", error);
    return false;
  }
};

/**
 * Get a user profile via Backend API
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const response = await fetch(`${API_URL}/users/profile/${userId}`);
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }

    const data = await response.json();
    return data as UserProfile;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};
