import { APP_VERSION } from "../constants/versions";

// Global application footer. Rendered once in the root Layout (App.tsx) so it
// appears on every page. The version always comes from APP_VERSION — never
// hard-code the version string here.
export default function Footer() {
  return (
    <footer className="app-footer">
      <span>Beach Volleyball Skills Database</span>
      <span className="app-footer-version">Version {APP_VERSION}</span>
    </footer>
  );
}
