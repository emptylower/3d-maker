import React from "react";
import { TableColumn } from "@/types/blocks/table";
import TableSlot from "@/components/dashboard/slots/table";
import { Table as TableSlotType } from "@/types/slots/table";
import { listAssets } from "@/models/asset";
import moment from "moment";

export default async function () {
  const assets = await listAssets(1, 50);

  const columns: TableColumn[] = [
    { name: "uuid", title: "UUID" },
    { name: "user_uuid", title: "User UUID" },
    { name: "file_format", title: "Format" },
    { name: "title", title: "Title" },
    {
      name: "created_at",
      title: "Created At",
      callback: (row) => (row.created_at ? moment(row.created_at).format("YYYY-MM-DD HH:mm:ss") : "-") ,
    },
  ];

  const table: TableSlotType = {
    title: "Assets",
    columns,
    data: assets,
    empty_message: "No assets found",
  };

  return <TableSlot {...table} />;
}
