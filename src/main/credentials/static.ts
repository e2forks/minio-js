import { ICredentials, IProvider, SignatureType } from ".";


export class StaticCred implements IProvider {
  protected cred!: ICredentials;
  constructor(
    accessKey: string,
    secretKey: string,
    sessionToken?: string,
    signerType: SignatureType = SignatureType.V4
  ) {
    this.cred = {
      accessKey,
      secretKey,
      sessionToken,
      signerType
    };
  }

  retrieve() {
    return Promise.resolve(this.cred);
  }

  // IsExpired returns if the credentials have been retrieved.
  isExpired() {
    return false;
  }
}
