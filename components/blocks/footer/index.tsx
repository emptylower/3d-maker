import { Footer as FooterType } from "@/types/blocks/footer";

export default function Footer({ footer }: { footer: FooterType }) {
  if (footer.disabled) return null;

  const yearText = footer.copyright || "© 2025 • xyris labs limited 保留所有权利。";
  const agreements = footer.agreement?.items?.length
    ? footer.agreement.items
    : [
        { title: "隐私政策", url: "/privacy-policy" },
        { title: "服务条款", url: "/terms-of-service" },
      ];

  return (
    <section id={footer.name} className="py-10">
      <div className="max-w-7xl mx-auto px-8">
        <footer>
          <div className="flex flex-col justify-between gap-4 border-t pt-6 text-center text-sm font-medium text-muted-foreground lg:flex-row lg:items-center lg:text-left">
            <p>
              {yearText}
              <a
                href="/"
                target="_blank"
                className="px-2 text-primary"
              >
                build with AI3DMARK
              </a>
            </p>
            <ul className="flex justify-center gap-4 lg:justify-start">
              {agreements.map((item, i) => (
                <li key={i} className="hover:text-primary">
                  <a href={item.url} target={item.target}>
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </div>
    </section>
  );
}
