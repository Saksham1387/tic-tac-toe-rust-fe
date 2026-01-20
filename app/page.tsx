"use client"
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getToken, getUserId, getUsername, getEmail, fetchUserData } from '@/lib/auth';
import Game from './game';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authData, setAuthData] = useState<{
    token: string;
    userId: string;
    username: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      if (!isAuthenticated()) {
        router.replace('/signin');
        return;
      }

      const token = getToken();
      const userId = getUserId();
      
      if (!token || !userId) {
        router.replace('/signin');
        return;
      }

      // Try to fetch fresh user data from /me endpoint
      const userData = await fetchUserData();
      
      if (userData) {
        setAuthData({ 
          token, 
          userId, 
          username: userData.username,
          email: userData.email
        });
      } else {
        // Fallback to stored data if /me endpoint fails
        const storedUsername = getUsername();
        const storedEmail = getEmail();
        
        if (storedUsername) {
          setAuthData({ 
            token, 
            userId, 
            username: storedUsername,
            email: storedEmail || ''
          });
        } else {
          router.replace('/signin');
          return;
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, [router]);

  if (loading || !authData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Game
      token={authData.token}
      userId={authData.userId}
      username={authData.username}
      email={authData.email}
    />
  );
}
