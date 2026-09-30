import React, { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Sign In — DocuMind",
  description: "Sign in to your DocuMind account to access your document knowledge base.",
};

function SignInFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[340px] text-slate-500 dark:text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mb-3" />
      <p className="text-sm font-medium">Initializing secure sign-in...</p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignIn
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
