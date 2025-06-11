'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen min-w-full flex flex-col bg-gradient-to-br from-blue-50 via-white to-gray-100">
      {/* Header */}
      <header className="w-full flex justify-between items-center px-8 py-6 bg-white/90 shadow">
        <div>
          <h1 className="text-3xl font-bold text-blue-900 tracking-tight">DTCC Post-Trade Processing Portal</h1>
          <p className="text-gray-600 mt-1 text-lg">Internal Use Only</p>
        </div>
        <nav className="flex gap-4">
          <Link
            href="/login"
            className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium transition-colors"
          >
            Sign Up
          </Link>
        </nav>
      </header>

      {/* Main Content: Full Screen, No Margins */}
      <section className="flex-1 flex flex-col justify-center items-center w-full h-full">
        <div className="w-full h-full flex flex-col md:flex-row">
          {/* Left: Welcome and Description */}
          <div className="flex-1 flex flex-col justify-center items-start bg-white/80 p-10">
            <h2 className="text-3xl font-semibold text-blue-800 mb-4">
              Welcome to the DTCC Post-Trade Processing Platform
            </h2>
            <p className="text-gray-700 text-lg mb-8">
              This secure portal is designed exclusively for DTCC internal teams to streamline and automate post-trade processing workflows.
              Our platform leverages advanced AI-driven tools for trade issue detection, analysis, and reporting—enabling faster settlements, reduced operational risk, and improved transparency across the trade lifecycle.
            </p>
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Getting Started</h3>
              <p className="text-gray-700 mb-2">
                Please <Link href="/login" className="text-blue-600 underline hover:text-blue-800">log in</Link> with your DTCC credentials to access the platform. New users can <Link href="/signup" className="text-green-600 underline hover:text-green-800">sign up</Link> for internal access.
              </p>
              <p className="text-gray-700">
                For support, contact the DTCC Post-Trade IT team.
              </p>
            </div>
          </div>
          {/* Right: Features and Benefits */}
          <div className="flex-1 flex flex-col justify-center items-start bg-gradient-to-tr from-blue-100 via-green-50 to-white p-10">
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-blue-700 mb-2">Key Features</h3>
              <ul className="list-disc list-inside text-gray-800 text-lg">
                <li>Automated trade data ingestion & normalization</li>
                <li>AI-powered issue analysis & anomaly detection</li>
                <li>Comprehensive trade issue reporting (CSV/PDF)</li>
                <li>Integrated notifications (Email, Teams)</li>
                <li>Role-based access and audit trails</li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-green-700 mb-2">How It Helps</h3>
              <ul className="list-disc list-inside text-gray-800 text-lg">
                <li>Accelerates post-trade resolution</li>
                <li>Minimizes manual intervention and errors</li>
                <li>Enhances compliance and reporting accuracy</li>
                <li>Supports DTCC’s operational excellence</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-gray-500 text-sm bg-white/90 shadow-inner">
        &copy; {new Date().getFullYear()} DTCC Internal Systems. All rights reserved.
      </footer>
    </main>
  );
}
