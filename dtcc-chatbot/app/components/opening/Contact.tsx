"use client";

export default function Contact() {
  return (
    <section className="py-12 md:py-20 lg:py-24 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-purple-500/10 animate-pulse"></div>
      </div>
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [background-size:24px_24px]" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center px-3 py-1 sm:px-4 sm:py-2 bg-blue-500/20 border border-blue-500/30 rounded-full mb-3 sm:mb-4">
            <span className="text-xs sm:text-sm font-medium text-blue-400">
              DTCC Support
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
            Contact <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">Post-Trade IT</span>
          </h2>
          <p className="text-slate-300 text-sm sm:text-base mb-6 sm:mb-8 max-w-2xl mx-auto">
            For any issues or questions about our services, please reach out to our dedicated support team.
          </p>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 sm:p-8 max-w-md mx-auto backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Email Support</h3>
              <a 
                href="mailto:posttrade-support@dtcc.com" 
                className="text-blue-400 hover:text-blue-300 transition-colors text-sm sm:text-base break-all"
              >
                posttrade-support@dtcc.com
              </a>
              <div className="mt-6 w-full">
                <a 
                  href="mailto:posttrade-support@dtcc.com"
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg transition-all duration-300 font-medium shadow-lg hover:shadow-blue-500/20 inline-flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  Send Email
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}