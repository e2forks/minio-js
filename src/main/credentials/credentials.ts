import { ICredentials, IProvider } from ".";


// Credentials - A container for synchronous safe retrieval of credentials Value.
// Credentials will cache the credentials value until they expire. Once the value
// expires the next Get will attempt to retrieve valid credentials.
//
// Credentials is safe to use across multiple goroutines and will manage the
// synchronous state so the Providers do not need to implement their own
// synchronization.
//
// The first Credentials.Get() will always call Provider.Retrieve() to get the
// first instance of the credentials Value. All calls to Get() after that
// will return the cached credentials Value until IsExpired() returns true.
export class Credentials {
  creds?: Promise<ICredentials>;
  constructor(public readonly provider: IProvider, public forceRefresh = true) {}

  // Get returns the credentials value, or error if the credentials Value failed
  // to be retrieved.
  //
  // Will return the cached credentials Value if it has not expired. If the
  // credentials Value has expired the Provider's Retrieve() will be called
  // to refresh the credentials.
  //
  // If Credentials.Expire() was called the credentials Value will be force
  // expired, and the next call to Get() will cause them to be refreshed.
  get() {
    if (this.isExpired()) {
      this.creds = this.provider.retrieve();
      this.forceRefresh = false;
    }
    return this.creds!;
  }

  // Expire expires the credentials and forces them to be retrieved on the
  // next call to Get().
  //
  // This will override the Provider's expired state, and force Credentials
  // to call the Provider's Retrieve().
  expire() {
    this.forceRefresh = true;
  }

  //   IsExpired returns if the credentials are no longer valid, and need
  //   to be refreshed.

  //   If the Credentials were forced to be expired with Expire() this will
  //   reflect that override.
  isExpired() {
    return this.forceRefresh || this.provider.isExpired();
  }
}

export class Expiry {
  constructor(public expiration: number = Date.now()) {}
  /**
   *
   * @param expiration epoch time (ms) for expiration
   * @param window window time (ms) to treat as expired.
   */
  setExpiration(expiration: number, window: number) {
    this.expiration = window > 0 ? expiration - window : expiration;
  }

  isExpired() {
    return Date.now() > this.expiration;
  }
}