import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("signup", "routes/signup.tsx"), // Added signup route
  route("signin", "routes/signin.tsx"), // Added signin route
  route("forgot-password", "routes/forgot-password.tsx"), // Added forgot password route
  route("reset-password", "routes/reset-password.tsx"), // Added reset password route
  route("mfa", "routes/mfa.tsx"), // Added MFA route
  route("documents", "routes/documents.tsx"), // Added documents route
  route("documents/create", "routes/document-create.tsx"), // Added document create route
  route("documents/:id/edit", "routes/document-edit.tsx"), // Added document edit route
  route("documents/:id", "routes/document-detail.tsx"), // Added document detail route
  route("trash", "routes/trash.tsx"), // Added trash route
  route("profile", "routes/profile.tsx"), // Added profile route
  route("archive", "routes/archive.tsx"), // Added archive route
] satisfies RouteConfig;
