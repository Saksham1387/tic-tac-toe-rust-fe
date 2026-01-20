export const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE}/api/v1`;
export const WS_URL = `${process.env.NEXT_PUBLIC_WS_BASE}/api/v1/ws`;

// Decode JWT payload (without verification - just for reading claims)
export function decodeJWT(token: string): { sub: string; exp: number } | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

// Token storage
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function removeToken(): void {
  localStorage.removeItem('token');
}

// Username storage (since signin only returns token)
export function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('username');
}

export function setUsername(username: string): void {
  localStorage.setItem('username', username);
}

export function removeUsername(): void {
  localStorage.removeItem('username');
}

// Get user ID from token
export function getUserId(): string | null {
  const token = getToken();
  if (!token) return null;
  const decoded = decodeJWT(token);
  return decoded?.sub || null;
}

// Check if authenticated
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  
  const decoded = decodeJWT(token);
  if (!decoded) return false;
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) {
    removeToken();
    removeUsername();
    return false;
  }
  
  return true;
}

// Email storage
export function getEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('email');
}

export function setEmail(email: string): void {
  localStorage.setItem('email', email);
}

export function removeEmail(): void {
  localStorage.removeItem('email');
}

// Fetch user data from /me endpoint
export async function fetchUserData(): Promise<{ username: string; email: string } | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: {
        'Authorization': `${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token is invalid, clear auth data
        logout();
      }
      return null;
    }

    const userData = await response.json();
    
    // Update stored user data
    if (userData.username) setUsername(userData.username);
    if (userData.email) setEmail(userData.email);
    
    return userData;
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    return null;
  }
}

// Create a new room
export async function createRoom(roomName: string, isPrivate: boolean = false, maxSpectators: number = 10): Promise<{ room_id: string; room_code: string } | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/create_room`, {
      method: 'POST',
      headers: {
        'Authorization': `${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: roomName,
        is_private: isPrivate,
        max_spectators: maxSpectators,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token is invalid, clear auth data
        logout();
      }
      return null;
    }

    const roomData = await response.json();
    return roomData;
  } catch (error) {
    console.error('Failed to create room:', error);
    return null;
  }
}

// Fetch user stats from /me/stats endpoint
export async function fetchUserStats(): Promise<{
  user_id: string;
  total_games: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  updated_at: string | null;
} | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/me/stats`, {
      headers: {
        'Authorization': `${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token is invalid, clear auth data
        logout();
      }
      return null;
    }

    const data = await response.json();
    return data.stats;
  } catch (error) {
    console.error('Failed to fetch user stats:', error);
    return null;
  }
}

// Clear all auth data
export function logout(): void {
  removeToken();
  removeUsername();
  removeEmail();
}
