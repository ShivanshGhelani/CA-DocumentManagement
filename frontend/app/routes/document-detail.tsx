import type { Route } from "./+types/document-detail";
// @ts-ignore  
import Navigation from "../../src/components/Navigation.tsx";
// @ts-ignore
import DocumentDetailPage from '../../src/pages/DocumentDetailPage';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Document Details - Document Management System" },
    { name: "description", content: "View document details and manage document" },
  ];
}

export default function DocumentDetailRoute() {
  return (
    <>
      <Navigation />
      <DocumentDetailPage />
    </>
  );
}
