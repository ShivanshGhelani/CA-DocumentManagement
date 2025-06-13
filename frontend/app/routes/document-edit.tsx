import type { Route } from "./+types/document-edit";
// @ts-ignore  
import Navigation from "../../src/components/Navigation.tsx";
// @ts-ignore
import DocumentEditPage from "../../src/pages/DocumentEditPage.jsx";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Edit Document - Document Management System" },
    { name: "description", content: "Edit document details and content" },
  ];
}

export default function DocumentEdit() {
  return (
    <>
      <Navigation />
      <DocumentEditPage />
    </>
  );
}
