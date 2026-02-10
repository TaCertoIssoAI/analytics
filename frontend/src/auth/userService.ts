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
  role?: 'admin' | 'user';
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

export interface TopReviewersResponse {
  reviewers: TopReviewer[];
  period: 'week' | 'all_time';
}

/**
 * Get top reviewers via Backend API
 */
export const getTopReviewers = async (): Promise<TopReviewersResponse> => {
  try {
    const response = await fetch(`${API_URL}/users/top-reviewers`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch top reviewers: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || { reviewers: [], period: 'week' };
  } catch (error) {
    console.error("Error fetching top reviewers:", error);
    return { reviewers: [], period: 'week' };
  }
};

interface UsersListResponse {
  users: UserProfile[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get all users (Admin only)
 */
export const getAllUsers = async (token: string, limit = 50, offset = 0): Promise<UsersListResponse> => {
  try {
    const response = await fetch(`${API_URL}/users?limit=${limit}&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching users:", error);
    return { users: [], total: 0, limit, offset };
  }
};

/**
 * Set user role (Admin only)
 */
export const setUserRole = async (token: string, uid: string, role: 'admin' | 'user'): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/users/${uid}/role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update user role: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Error updating user role:", error);
    return false;
  }
};

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'user';
}

/**
 * Create a new user (Admin only)
 */
export const createUser = async (token: string, data: CreateUserRequest): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        message: errorData.detail || `Failed to create user: ${response.statusText}` 
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, message: "Network error or server unreachable" };
  }
};

/**
 * Delete a user (Admin only)
 */
export const deleteUser = async (token: string, uid: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_URL}/users/${uid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          message: errorData.detail || `Failed to delete user: ${response.statusText}` 
        };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, message: "Network error or server unreachable" };
  }
};
