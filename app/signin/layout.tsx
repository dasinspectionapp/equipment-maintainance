import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - Distribution Automation System (DAS)',
  description: 'Sign in to the BESCOM Distribution Automation System',
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}





























