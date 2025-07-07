import type { Route } from "./+types/signup";
// @ts-ignore
import SignupPage from '../../src/pages/SignupPage.jsx';
import Navigation from "../../src/components/Navigation";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign Up - Document Management System" },
    { name: "description", content: "Create your account" },
  ];
}

export default function SignupRoute() {
  return (
    <>
      <Navigation />
      <SignupPage />
    </>
  );
}
