import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata = {
  title: "DocuMind — AI Document Intelligence & Knowledge Assistant",
  description: "Upload, search, analyze, and chat with your documents using advanced AI and RAG.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
