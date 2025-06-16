import type { Route } from "./+types/documents";
// @ts-ignore  
import Navigation from "../../src/components/Navigation";
// @ts-ignore
import DocumentListPage from '../../src/pages/DocumentListPage.jsx';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Documents - Document Management System" },
    { name: "description", content: "View and manage your documents" },
  ];
}

export default function DocumentsRoute() {
  return (
    <>
      <Navigation />
      <DocumentListPage />
    </>
  );
}
