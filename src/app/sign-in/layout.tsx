import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - HogBall',
  description: 'Sign in to your HogBall account',
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
