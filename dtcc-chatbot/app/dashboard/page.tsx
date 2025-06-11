'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import ChatInterface from '@/app/components/ChatInterface';

export default function DashboardPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
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
    return null;
  }

  if (!userData) {
    router.replace('/');
    return null;
  }

  return (
    <div className="relative min-h-screen h-screen w-full flex flex-col bg-slate-900">
      {/* Grid pattern background */}
      <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [background-size:24px_24px]"></div>
      
      <header className="relative z-10 w-full flex justify-between items-center px-8 py-6 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome, <span className="text-blue-400">{userData?.email}</span>
          </h1>
          <div className="security-section mt-1">
            {userData?.providers?.includes('password') ? (
              <p className="text-sm text-green-400 flex items-center">
                <span className="mr-1">Account security: Password set</span>
                <span>✔️</span>
              </p>
            ) : (
              <Link 
                href="/profile" 
                className="text-blue-400 text-sm hover:text-blue-300 transition-colors"
              >
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
          className="px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 transition-colors"
        >
          Logout
        </button>
      </header>

      <main className="relative z-10 flex-1 h-full w-full flex flex-col">
        <ChatInterface email={userData?.email} />
      </main>
    </div>
  );
}