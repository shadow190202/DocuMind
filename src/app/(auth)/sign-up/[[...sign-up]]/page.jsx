import { SignUp } from "@clerk/nextjs";

export const metadata = {
  title: "Sign Up — DocuMind",
  description: "Create your DocuMind account to start interacting with your documents using AI.",
};

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "shadow-xl border border-slate-200 dark:border-slate-800 rounded-2xl",
        },
      }}
    />
  );
}
