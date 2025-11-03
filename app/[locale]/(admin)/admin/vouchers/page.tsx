import { TableColumn } from "@/types/blocks/table";
import TableSlot from "@/components/dashboard/slots/table";
import { Table as TableSlotType } from "@/types/slots/table";
import { listVouchers } from "@/models/voucher";
import moment from "moment";
import DisableVoucherButton from "@/components/dashboard/actions/disable-voucher-button";

export default async function () {
  const vouchers = await listVouchers(1, 50);

  const columns: TableColumn[] = [
    { name: "code", title: "Code" },
    { name: "credits", title: "Credits" },
    { name: "valid_months", title: "Valid Months" },
    { name: "max_redemptions", title: "Max Redemptions" },
    { name: "used_count", title: "Used" },
    { name: "status", title: "Status" },
    { name: "issued_by", title: "Issued By" },
    {
      name: "created_at",
      title: "Created At",
      callback: (row) => (row.created_at ? moment(row.created_at).format("YYYY-MM-DD HH:mm:ss") : "-") ,
    },
    {
      title: "Actions",
      callback: (row) => <DisableVoucherButton code={row.code} disabled={row.status !== 'active'} />,
    },
  ];

  const table: TableSlotType = {
    title: "Vouchers",
    columns,
    data: vouchers,
    empty_message: "No vouchers found",
  };

  return <TableSlot {...table} />;
}

