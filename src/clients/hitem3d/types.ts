export type HToken = { accessToken: string; tokenType: string; expiresAt: number };

export type SubmitTaskParams = {
  request_type: 1 | 2 | 3;
  model: 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5';
  resolution?: number | '1536pro';
  images?: Array<{ filename: string; content: Buffer }>; // one entry only if provided
  multi_images?: Array<{ filename: string; content: Buffer }>; // up to 4
  mesh_url?: string;
  face?: number;
  format?: 1 | 2 | 3 | 4; // obj|glb|stl|fbx
  callback_url?: string;
};

export type SubmitTaskResult = {
  task_id: string;
  state: string;
};

export type QueryTaskResult = {
  task_id: string;
  state: 'pending' | 'processing' | 'succeeded' | 'failed';
  model_urls?: { glb?: string; obj?: string; preview?: string };
  error_code?: string;
  error_message?: string;
};

export type Hitem3DError = {
  type: 'invalid_request' | 'unauthorized' | 'rate_limited' | 'server_error' | 'hitem3d_error';
  message: string;
  status: number;
  h_code?: string;
};

