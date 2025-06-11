'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import ChatInterface from '@/app/components/ChatInterface';

export default function DashboardPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true); // Track loading state
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        // Not authenticated, redirect to home
        router.replace('/');
        setLoading(false);
      } else {
        try {
          const response = await fetch(`/api/users/${user.uid}`);
          if (response.ok) setUserData(await response.json());
        } catch (error) {
          console.error('Failed to fetch user data:', error);
        }
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    // Optionally render a loading spinner or nothing
    return null;
  }

  // If not authenticated, you can optionally double-check and redirect
  if (!userData) {
    // This is a fallback; normally, the redirect above will handle it
    router.replace('/');
    return null;
  }

  return (
    <div className="min-h-screen h-screen w-full flex flex-col bg-gradient-to-br from-blue-50 via-white to-gray-100">
      <header className="w-full flex justify-between items-center px-8 py-6 bg-white/90 shadow">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">
            Welcome, {userData?.email}
          </h1>
          <div className="security-section mt-1">
            {userData?.providers?.includes('password') ? (
              <p className="text-sm text-green-600">
                Account security: Password set ✔️
              </p>
            ) : (
              <Link href="/profile" className="text-blue-600 text-sm">
                Set up password for email login
              </Link>
            )}
          </div>
        </div>
        <button
          onClick={async () => {
            await auth.signOut();
            router.push('/');
          }}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </header>

      <main className="flex-1 h-full w-full flex flex-col">
        <ChatInterface email={userData?.email} />
      </main>
    </div>
  );
}
