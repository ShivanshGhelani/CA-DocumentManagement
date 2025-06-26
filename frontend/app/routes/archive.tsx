import type { Route } from "./+types/archive";
// @ts-ignore  
import Navigation from "../../src/components/Navigation";
// @ts-ignore
import ArchivePage from '../../src/pages/ArchivePage.jsx';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Archive - Document Management System" },
    { name: "description", content: "View and restore archived documents" },
  ];
}

export default function ArchiveRoute() {
  return (
    <>
      <Navigation />
      <ArchivePage />
    </>
  );
}
