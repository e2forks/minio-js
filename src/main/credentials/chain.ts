import { AnonymousCredentials, ICredentials, IProvider } from ".";

export class ChainCredentials implements IProvider {
  protected curr?: IProvider;
  constructor(public readonly providers: IProvider[]) {}

  protected _retrieve(index: number = 0): Promise<ICredentials> {
    if (index >= this.providers.length) {
      return Promise.resolve(AnonymousCredentials);
    }
    const provider = this.providers[index];
    return provider.retrieve().then(cred => {
      if (!cred || (cred.accessKey === "" && cred.secretKey === "")) {
        return this._retrieve(index + 1);
      }
      return cred;
    });
  }

  retrieve() {
    return this._retrieve();
  }

  isExpired() {
    if (!this.curr) return true;
    return this.curr.isExpired();
  }
}
