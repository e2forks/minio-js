export interface IProvider {
  retrieve(): Promise<ICredentials>;
  isExpired(): boolean;
}

export interface ICredentials {
  accessKey: string;
  secretKey: string;
  sessionToken?: string;
  signerType: SignatureType;
}

export enum SignatureType {
  V4 = "S3v4",
  // V2 = "S3v2", // #TODO: not implemented
  // V4Streaming = "S3v4Streaming", // #TODO: not implemented
  /** Anonymous signature signifies, no signature. */
  Anonymous = "Anonymous"
}

export const AnonymousCredentials: ICredentials = {
  accessKey: "",
  secretKey: "",
  signerType: SignatureType.Anonymous
};