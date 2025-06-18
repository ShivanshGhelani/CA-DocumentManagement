// @ts-ignore
import ProfilePage from "../../src/pages/ProfilePage.jsx";

export function meta() {
  return [
    { title: "Profile - Document Management" },
    { name: "description", content: "Manage your user profile and settings" },
  ];
}

export default function Profile() {
  return <ProfilePage />;
}
