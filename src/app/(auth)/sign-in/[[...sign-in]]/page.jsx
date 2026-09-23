import { SignIn } from "@clerk/nextjs";

export const metadata = {
  title: "Sign In — DocuMind",
  description: "Sign in to your DocuMind account to access your document knowledge base.",
};

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "shadow-xl border border-slate-200 dark:border-slate-800 rounded-2xl",
        },
      }}
    />
  );
}
