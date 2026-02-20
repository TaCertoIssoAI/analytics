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

export interface UserSuggestedSourceItem {
  url: string;
  title?: string;
}

export interface UserSuggestedSourceEntry {
  items: UserSuggestedSourceItem[];
  observation: string;
}

export interface UserInteraction {
  document_id: string;
  analysis_title?: string;
  user_message_text?: string;
  processed_at: string;
  overall_verdict: string;
  user_interaction: 'like' | 'dislike' | 'neutral';
  user_observation?: string;
  has_custom_observation?: boolean;
  user_suggested_sources?: Record<string, UserSuggestedSourceEntry>;
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
 * Get community members (public, no auth required)
 */
export const getCommunityMembers = async (limit = 50, offset = 0, search = ""): Promise<UsersListResponse> => {
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set("search", search);
    
    const response = await fetch(`${API_URL}/users/community?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch community members: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || { users: [], total: 0, limit, offset };
  } catch (error) {
    console.error("Error fetching community members:", error);
    return { users: [], total: 0, limit, offset };
  }
};

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

    if (response.status === 403) {
      window.location.href = "/nao-autorizado";
      throw new Error("Access denied");
    }
    
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

    if (response.status === 403) {
      window.location.href = "/nao-autorizado";
      return false;
    }
    
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

    if (response.status === 403) {
      window.location.href = "/nao-autorizado";
      return { success: false, message: "Access denied" };
    }
    
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

    if (response.status === 403) {
      window.location.href = "/nao-autorizado";
      return { success: false, message: "Access denied" };
    }
    
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

export interface UpdateUserProfileRequest {
  bio?: string;
  occupation?: string;
  socials?: {
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  };
}

/**
 * Update a user's profile fields (Admin only)
 */
export const adminUpdateUserProfile = async (
  token: string, 
  uid: string, 
  data: UpdateUserProfileRequest
): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_URL}/users/${uid}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (response.status === 403) {
      window.location.href = "/nao-autorizado";
      return { success: false, message: "Acesso negado" };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.detail || `Erro ao atualizar perfil: ${response.statusText}`
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { success: false, message: "Erro de rede ou servidor indisponível" };
  }
};

/**
 * Reset a user's password (Admin only)
 */
export const adminResetUserPassword = async (
  token: string,
  uid: string,
  newPassword: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_URL}/users/${uid}/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ new_password: newPassword })
    });

    if (response.status === 403) {
      window.location.href = "/nao-autorizado";
      return { success: false, message: "Acesso negado" };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.detail || `Erro ao redefinir senha: ${response.statusText}`
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { success: false, message: "Erro de rede ou servidor indisponível" };
  }
};
