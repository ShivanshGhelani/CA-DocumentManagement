import type { Route } from "./+types/signin";
// @ts-ignore
import SigninPage from '../../src/pages/SigninPage.jsx';
import Navigation from "../../src/components/Navigation";
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign In - Document Management System" },
    { name: "description", content: "Sign in to your account" },
  ];
}

export default function SigninRoute() {
  return (
    <>
      <Navigation />
      <SigninPage />
    </>
  );
}
