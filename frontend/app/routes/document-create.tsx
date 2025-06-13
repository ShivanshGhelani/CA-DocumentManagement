import type { Route } from "./+types/document-create";
// @ts-ignore  
import Navigation from "../../src/components/Navigation.tsx";
// @ts-ignore
import DocumentCreatePage from '../../src/pages/DocumentCreatePage.jsx';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Upload Document - Document Management System" },
    { name: "description", content: "Upload and create new documents" },
  ];
}

export default function DocumentCreateRoute() {
  return (
    <>
      <Navigation />
      <DocumentCreatePage />
    </>
  );
}
