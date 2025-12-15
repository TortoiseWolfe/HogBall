import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - HogBall',
  description: 'Create a new HogBall account',
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
