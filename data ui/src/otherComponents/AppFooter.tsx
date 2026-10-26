import Brand from "./Brand";

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <Brand small />
      <span>A little clarity. A lot of potential.</span>
      <span>© {new Date().getFullYear()} Skillora</span>
    </footer>
  );
}
