import DashboardLayout from "@/components/dashboard/layout";
import Empty from "@/components/blocks/empty";
import { ReactNode } from "react";
import { Sidebar } from "@/types/blocks/sidebar";
import { getUserInfo } from "@/services/user";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const userInfo = await getUserInfo();
  if (!userInfo || !userInfo.email) {
    redirect("/auth/signin");
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(",");
  if (!adminEmails?.includes(userInfo?.email)) {
    return <Empty message="No access" />;
  }

  const sidebar: Sidebar = {
    brand: {
      title: "AI3DMARK",
      logo: {
        src: "/logo.svg",
        alt: "AI3DMARK",
      },
      url: "/admin",
    },
    nav: {
      items: [
        {
          title: "Users",
          url: "/admin/users",
          icon: "RiUserLine",
        },
        {
          title: "Assets",
          url: "/admin/assets",
          icon: "RiGalleryLine",
        },
        {
          title: "Generation Tasks",
          url: "/admin/generation-tasks",
          icon: "RiCpuLine",
        },
        {
          title: "Orders",
          icon: "RiOrderPlayLine",
          is_expand: true,
          children: [
            {
              title: "Paid Orders",
              url: "/admin/paid-orders",
            },
          ],
        },
        {
          title: "Vouchers",
          url: "/admin/vouchers",
          icon: "RiTicketLine",
        },
        {
          title: "Publications",
          url: "/admin/publications",
          icon: "RiArticleLine",
        },
        {
          title: "Reports",
          url: "/admin/reports",
          icon: "RiFlagLine",
        },
        {
          title: "Posts",
          url: "/admin/posts",
          icon: "RiArticleLine",
        },
      ],
    },
    social: {
      items: [
        {
          title: "Home",
          url: "/",
          target: "_blank",
          icon: "RiHomeLine",
        },
        {
          title: "Github",
          url: "https://github.com/shipanyai/shipany-template-one",
          target: "_blank",
          icon: "RiGithubLine",
        },
        {
          title: "Discord",
          url: "https://discord.gg/HQNnrzjZQS",
          target: "_blank",
          icon: "RiDiscordLine",
        },
        {
          title: "X",
          url: "https://x.com/shipanyai",
          target: "_blank",
          icon: "RiTwitterLine",
        },
      ],
    },
  };

  return <DashboardLayout sidebar={sidebar}>{children}</DashboardLayout>;
}
