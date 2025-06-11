// components/opening/Features.tsx
"use client";

import { Zap, EyeOff, FileText, Bell, Users, CheckCircle } from "lucide-react";

export default function Features() {
  const features = [
    {
      title: "Automated Trade Ingestion",
      icon: Zap,
      description: "Automated trade data ingestion & normalization to streamline operations.",
      bgColor: "bg-slate-800/80",
      textColor: "text-white",
      borderColor: "border-blue-500/30"
    },
    {
      title: "AI-Powered Analysis",
      icon: EyeOff,
      description: "AI-driven anomaly detection and issue analysis improves accuracy.",
      bgColor: "bg-slate-800/80",
      textColor: "text-white",
      borderColor: "border-purple-500/30"
    },
    {
      title: "Detailed Reporting",
      icon: FileText,
      description: "Generate comprehensive trade issue reports in CSV/PDF formats.",
      bgColor: "bg-slate-800/80",
      textColor: "text-white",
      borderColor: "border-green-500/30"
    },
    {
      title: "Real-Time Notifications",
      icon: Bell,
      description: "Integrated email and Teams notifications keep stakeholders updated.",
      bgColor: "bg-slate-800/80",
      textColor: "text-white",
      borderColor: "border-yellow-400/30"
    },
    {
      title: "Role-Based Access",
      icon: Users,
      description: "Enforce permissions and maintain detailed audit trails with ease.",
      bgColor: "bg-slate-800/80",
      textColor: "text-white",
      borderColor: "border-red-500/30"
    },
    {
      title: "Operational Excellence",
      icon: CheckCircle,
      description: "Enhances compliance, reduces errors, and supports DTCC's excellence.",
      bgColor: "bg-slate-800/80",
      textColor: "text-white",
      borderColor: "border-indigo-500/30"
    }
  ];

  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-24 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-purple-500/10 animate-pulse"></div>
      </div>
      <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8 sm:mb-10 md:mb-12 text-center">
          <div className="inline-flex items-center px-3 py-1 sm:px-4 sm:py-2 bg-blue-500/20 border border-blue-500/30 rounded-full mb-3 sm:mb-4">
            <span className="text-xs sm:text-sm font-medium text-blue-400">
              Features & Benefits
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
            Enhance Post-Trade Validation
          </h3>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
            Empower DTCC operations with automated ingestion, intelligent analysis, and transparent reporting.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`${feature.bgColor} border ${feature.borderColor} rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2 shadow-md sm:shadow-xl backdrop-blur-sm`}
            >
              <div className="p-5 sm:p-6 md:p-7 lg:p-8 h-full">
                <div className="flex flex-col h-full">
                  <div className="mb-4 sm:mb-5 md:mb-6 bg-gradient-to-r from-blue-600 to-purple-600 w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center">
                    <feature.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${feature.textColor}`} />
                  </div>
                  <h3 className={`text-lg sm:text-xl font-bold mb-2 sm:mb-3 ${feature.textColor}`}>
                    {feature.title}
                  </h3>
                  <p className={`${feature.textColor} opacity-80 mb-4 sm:mb-5 md:mb-6 flex-grow text-xs sm:text-sm md:text-base`}>
                    {feature.description}
                  </p>
                  <div className="w-12 sm:w-16 h-1 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
