import { TableColumn } from "@/types/blocks/table";
import TableSlot from "@/components/dashboard/slots/table";
import { Table as TableSlotType } from "@/types/slots/table";
import { listReports } from "@/models/report";
import moment from "moment";

export default async function () {
  const reports = await listReports(1, 50);

  const columns: TableColumn[] = [
    { name: "id", title: "ID" },
    { name: "publication_id", title: "Publication ID" },
    { name: "user_uuid", title: "User UUID" },
    { name: "reason", title: "Reason" },
    {
      name: "created_at",
      title: "Created At",
      callback: (row) => (row.created_at ? moment(row.created_at).format("YYYY-MM-DD HH:mm:ss") : "-") ,
    },
  ];

  const table: TableSlotType = {
    title: "Reports",
    columns,
    data: reports,
    empty_message: "No reports found",
  };

  return <TableSlot {...table} />;
}

