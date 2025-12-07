import { User } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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

export interface UserInteraction {
  document_id: string;
  analysis_title?: string;
  user_message_text?: string;
  processed_at: string;
  overall_verdict: string;
  user_interaction: 'like' | 'dislike';
}

/**
 * Get user interactions (reviews) via Backend API
 */
export const getUserInteractions = async (userId: string): Promise<UserInteraction[]> => {
  try {
    const response = await fetch(`${API_URL}/users/${userId}/interactions`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch interactions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.interactions || [];
  } catch (error) {
    console.error("Error fetching user interactions:", error);
    return [];
  }
};
export interface TopReviewer {
  user: UserProfile;
  count: number;
}

/**
 * Get top reviewers via Backend API
 */
export const getTopReviewers = async (): Promise<TopReviewer[]> => {
  try {
    const response = await fetch(`${API_URL}/users/top-reviewers`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch top reviewers: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error("Error fetching top reviewers:", error);
    return [];
  }
};
