// app/page.tsx
"use client";

import Navbar from "./components/opening/Navbar"; 
import Hero from "./components/opening/Hero";
import Features from "./components/opening/Features";
import Contact from "./components/opening/Contact";
import Footer from "./components/opening/Footer";

export default function Home() {
  return (
    <main className="min-h-screen min-w-full flex flex-col bg-gradient-to-br from-blue-50 via-white to-gray-100">
      <Navbar />
      <Hero />
      <Features />
      <Contact />
      <Footer />
    </main>
  );
}