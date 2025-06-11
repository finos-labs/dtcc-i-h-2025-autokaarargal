'use client';

import Image from "next/image";



export default function Hero() {



  return (
    <>

      <section className="relative min-h-screen bg-slate-900 overflow-x-hidden">
        {/* Grid pattern background */}
        <div className="absolute inset-0 opacity-5 [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Hero Section */}
        <div className="container mx-auto px-4 sm:px-6 pt-12 md:pt-16 lg:pt-20 pb-16 md:pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="relative z-10 px-4 sm:px-6 md:px-8 lg:pl-12">
              <div className="inline-flex items-center px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full mb-4 md:mb-6">
                <span className="text-sm font-medium text-blue-400">
                  Internal DTCC Portal
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6 leading-tight">
                Streamline
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                  Post-Trade Processing
                </span>
              </h1>
              <p className="text-lg text-slate-300 mb-6 md:mb-8 max-w-lg">
                Secure portal for DTCC teams to automate trade workflows, detect issues, and enhance settlement operations with AI.
              </p>

         
            </div>

            {/* Right Image */}
            <div className="relative h-full min-h-[300px] md:min-h-[400px] lg:min-h-[500px] md:-ml-8 lg:-ml-12">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-3xl" />
              <div className="relative h-full w-full overflow-hidden rounded-3xl shadow-2xl">
              <Image
                src="/images/cover1.jpg"
                alt="Post Trade Processing"
                fill
                className="object-cover object-center" // Added object-center
                priority
                quality={85}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
              />
              </div>
            </div>
          </div>
        </div>
  
      </section>
    </>
  );
}
