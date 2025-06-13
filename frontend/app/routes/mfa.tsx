import type { Route } from "./+types/mfa";
// @ts-ignore  
import Navigation from "../../src/components/Navigation.tsx";
// @ts-ignore
import MFAPage from '../../src/pages/MFAPage';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MFA Verification - Document Management System" },
    { name: "description", content: "Multi-factor authentication verification" },
  ];
}

export default function MFARoute() {
  return (
    <>
      <Navigation />
      <MFAPage />
    </>
  );
}
