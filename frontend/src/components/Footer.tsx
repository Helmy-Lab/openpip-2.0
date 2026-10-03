interface FooterProps {
  html: string;
}

export function Footer({ html }: FooterProps) {
  return (
    <footer
      className="py-6 px-6 text-sm"
      style={{
        color: "var(--text-muted)",
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--surface-alt)",
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {/* Hardcoded on purpose: not in the site-text registry, not admin-editable.
          Every deployment credits the project's reference portal. */}
      <div className="mt-4 text-xs" style={{ opacity: 0.7 }}>
        Powered by{" "}
        <a
          href="https://openpip.usask.ca"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          openPIP 2.0
        </a>
      </div>
    </footer>
  );
}
