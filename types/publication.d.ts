export interface Publication {
  id: number;
  asset_uuid: string;
  user_uuid: string;
  title?: string;
  description?: string;
  preview_key?: string;
  printed_photos_count: number;
  contact_email?: string;
  contact_tel?: string;
  contact_wechat?: string;
  contact_qq?: string;
  slug?: string;
  status: 'online' | 'offline';
  created_at?: string;
  updated_at?: string;
}

