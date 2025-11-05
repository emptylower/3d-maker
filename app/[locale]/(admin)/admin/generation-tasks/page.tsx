import React from "react";
import { TableColumn } from "@/types/blocks/table";
import TableSlot from "@/components/dashboard/slots/table";
import { Table as TableSlotType } from "@/types/slots/table";
import { listGenerationTasks } from "@/models/generation-task";
import moment from "moment";

export default async function () {
  const tasks = await listGenerationTasks(1, 50);

  const columns: TableColumn[] = [
    { name: "task_id", title: "Task ID" },
    { name: "user_uuid", title: "User UUID" },
    { name: "model_version", title: "Model Version" },
    { name: "state", title: "State" },
    {
      name: "created_at",
      title: "Created At",
      callback: (row) => (row.created_at ? moment(row.created_at).format("YYYY-MM-DD HH:mm:ss") : "-") ,
    },
  ];

  const table: TableSlotType = {
    title: "Generation Tasks",
    columns,
    data: tasks,
    empty_message: "No tasks found",
  };

  return <TableSlot {...table} />;
}
