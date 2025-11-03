import { TableColumn } from "@/types/blocks/table";
import TableSlot from "@/components/dashboard/slots/table";
import { Table as TableSlotType } from "@/types/slots/table";
import { listPublications } from "@/models/publication";
import moment from "moment";
import OfflinePublicationButton from "@/components/dashboard/actions/offline-publication-button";

export default async function () {
  const publications = await listPublications(1, 50);

  const columns: TableColumn[] = [
    { name: "id", title: "ID" },
    { name: "slug", title: "Slug" },
    { name: "title", title: "Title" },
    { name: "status", title: "Status" },
    {
      name: "created_at",
      title: "Created At",
      callback: (row) => (row.created_at ? moment(row.created_at).format("YYYY-MM-DD HH:mm:ss") : "-") ,
    },
    {
      title: "Actions",
      callback: (row) => <OfflinePublicationButton id={row.id} disabled={row.status !== 'online'} />,
    },
  ];

  const table: TableSlotType = {
    title: "Publications",
    columns,
    data: publications,
    empty_message: "No publications found",
  };

  return <TableSlot {...table} />;
}

