import React, { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Sign Up — DocuMind",
  description: "Create your DocuMind account to start interacting with your documents using AI.",
};

function SignUpFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[340px] text-slate-500 dark:text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mb-3" />
      <p className="text-sm font-medium">Initializing secure registration...</p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpFallback />}>
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl border border-slate-200 dark:border-slate-800 rounded-2xl",
          },
        }}
      />
    </Suspense>
  );
}
