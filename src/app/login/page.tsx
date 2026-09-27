import type { Metadata } from "next";
import SignInForm from "@/components/login/SignInForm";
import { BRAND_ALT, BrandLogo, BrandMark } from "@/components/Brand";

export const metadata: Metadata = {
  title: "Sign In — ATecHS Hub",
  description: "Sign in to the ATecHS organization hub.",
};

export default function LoginPage() {
  return (
    <main className="auth-page" id="content">
      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-card">
        <div className="brand">
          <BrandLogo alt={BRAND_ALT} />
          <span aria-hidden="true">
            <BrandMark />
          </span>
        </div>
        <h1 className="auth-title">Welcome back.</h1>
        <p className="auth-sub">Sign in to continue to the ATecHS organization hub.</p>
        <SignInForm />
      </div>
    </main>
  );
}
