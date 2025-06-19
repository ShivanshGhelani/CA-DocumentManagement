import type { Route } from "./+types/trash";
// @ts-ignore  
import Navigation from "../../src/components/Navigation";
// @ts-ignore
import TrashPage from '../../src/pages/TrashPage.jsx';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Trash - Document Management System" },
    { name: "description", content: "View and restore deleted documents" },
  ];
}

export default function TrashRoute() {
  return (
    <>
      <Navigation />
      <TrashPage />
    </>
  );
}
