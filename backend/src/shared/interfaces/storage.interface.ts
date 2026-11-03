export interface StoredObject {
  key: string;
  size: number;
}

export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
}

/** Error of the Cloud Storage client: HTTP status in `code`. */
export interface StorageApiError {
  code?: number;
}
