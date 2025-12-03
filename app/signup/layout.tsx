import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - Distribution Automation System (DAS)',
  description: 'Create an account for the BESCOM Distribution Automation System',
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

