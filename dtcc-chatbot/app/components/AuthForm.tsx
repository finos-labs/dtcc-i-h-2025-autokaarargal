'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  auth,
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
} from '@/lib/firebase';
import { browserLocalPersistence, User, AuthCredential } from 'firebase/auth';

interface AuthFormProps {
  isLogin: boolean;
  onSuccess: () => void;
  initialEmail?: string;
}

// Allowed domains for signup/login
const allowedDomains = ['@dtcc.com', '@licet.ac.in'];
function isEmailAllowed(email: string) {
  return allowedDomains.some(domain => email.toLowerCase().endsWith(domain));
}

export default function AuthForm({
  isLogin,
  onSuccess,
  initialEmail = '',
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isEmailAllowed(email)) {
      setError('Access is restricted to authorized DTCC or LICET users only.');
      return;
    }

    try {
      await auth.setPersistence(browserLocalPersistence);

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        await saveUserToDB(auth.currentUser!);
      }
      onSuccess();
    } catch (err: any) {
      handleError(err);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await auth.setPersistence(browserLocalPersistence);
      const result = await signInWithPopup(auth, googleProvider);

      if (result.user) {
        if (!isEmailAllowed(result.user.email || '')) {
          setError('Access is restricted to authorized DTCC or LICET users only.');
          await auth.signOut();
          return;
        }
        await saveUserToDB(result.user, 'google');
        onSuccess();
      }
    } catch (err: any) {
      if (err.code === 'auth/account-exists-with-different-credential') {
        await handleAccountConflict(err);
      } else {
        handleError(err);
      }
    }
  };

  const handleAccountConflict = async (error: any) => {
    const email: string = error.customData?.email;
    const pendingCred: AuthCredential = error.credential;

    if (!email || !pendingCred) {
      handleError(new Error('Missing email or credential for account conflict.'));
      return;
    }

    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);

      if (methods.includes(EmailAuthProvider.PROVIDER_ID)) {
        const password = prompt(`Enter password for ${email} to link accounts:`);

        if (!password) throw new Error('Password is required to link accounts.');

        const result = await signInWithEmailAndPassword(auth, email, password);
        await linkWithCredential(result.user, pendingCred);
        await saveUserToDB(result.user, 'google');
        onSuccess();
      } else {
        throw new Error(
          'Account exists with a different authentication method. Please use the correct sign-in method.'
        );
      }
    } catch (err) {
      handleError(err);
      await auth.signOut();
    }
  };

  const saveUserToDB = async (user: User, newProvider?: string) => {
    const providers = [
      ...new Set([
        ...user.providerData.map((p) => p.providerId.replace('.com', '')),
        ...(newProvider ? [newProvider] : []),
      ]),
    ];

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        providers,
        updatedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) throw new Error('Failed to save user data');
  };

  const handleError = (error: any) => {
    if (!isMounted) return;
    setError(error?.message || 'Authentication failed');
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-gray-100">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 flex flex-col gap-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-blue-900 mb-1">
            {isLogin ? 'Login to DTCC Portal' : 'Sign Up for DTCC Portal'}
          </h1>
          <p className="text-gray-600 text-sm">
            {isLogin
              ? 'Enter your credentials to access the DTCC Post-Trade Processing Platform.'
              : 'Create your internal account to access DTCC post-trade tools.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            {isLogin ? 'Login' : 'Create Account'}
          </button>
          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2 text-center">
              {error}
            </div>
          )}
        </form>
        <div className="flex items-center gap-2 my-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-xs">OR</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <button
          className="w-full py-3 flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={handleGoogleSignIn}
          type="button"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <g>
              <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.6l6.85-6.85C36.53 2.89 30.76 0 24 0 14.82 0 6.82 5.85 2.67 14.29l7.96 6.19C12.19 13.89 17.58 9.5 24 9.5z"/>
              <path fill="#34A853" d="M46.1 24.5c0-1.61-.14-3.15-.39-4.63H24v9.19h12.43c-.54 2.93-2.18 5.4-4.66 7.06l7.2 5.59C43.98 37.06 46.1 31.31 46.1 24.5z"/>
              <path fill="#FBBC05" d="M10.63 28.48a14.47 14.47 0 0 1 0-8.95l-7.96-6.19A24.01 24.01 0 0 0 0 24c0 3.77.9 7.35 2.67 10.71l7.96-6.23z"/>
              <path fill="#EA4335" d="M24 48c6.76 0 12.53-2.23 16.7-6.06l-7.2-5.59c-2.01 1.36-4.58 2.17-7.5 2.17-6.42 0-11.81-4.39-13.37-10.29l-7.96 6.23C6.82 42.15 14.82 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </g>
          </svg>
          Continue with Google
        </button>
        <div className="text-center text-gray-600 mt-2">
          {isLogin ? (
            <span>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="text-blue-600 underline hover:text-blue-800"
                onClick={() => router.push('/signup')}
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                className="text-blue-600 underline hover:text-blue-800"
                onClick={() => router.push('/login')}
              >
                Login
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
