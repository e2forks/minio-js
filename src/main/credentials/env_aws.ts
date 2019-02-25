import { IProvider, SignatureType } from ".";

// A EnvAWS retrieves credentials from the environment variables of the
// running process. EnvAWSironment credentials never expire.
//
// EnvAWSironment variables used:
//
// * Access Key ID:     AWS_ACCESS_KEY_ID or AWS_ACCESS_KEY.
// * Secret Access Key: AWS_SECRET_ACCESS_KEY or AWS_SECRET_KEY.
// * Secret Token:      AWS_SESSION_TOKEN.
class EnvAWS implements IProvider {
  retrieved: boolean = false;

  retrieve() {
    const {
      AWS_ACCESS_KEY_ID = "",
      AWS_ACCESS_KEY = "",
      AWS_SECRET_ACCESS_KEY = "",
      AWS_SECRET_KEY = "",
      AWS_SESSION_TOKEN
    } = process.env;
    const accessKey =
      AWS_ACCESS_KEY_ID === "" ? AWS_ACCESS_KEY : AWS_ACCESS_KEY_ID;
    const secretKey =
      AWS_SECRET_ACCESS_KEY === "" ? AWS_SECRET_KEY : AWS_SECRET_ACCESS_KEY;
    const cred = {
      accessKey,
      secretKey,
      sessionToken: AWS_SESSION_TOKEN,
      signerType:
        accessKey == "" || accessKey == ""
          ? SignatureType.Anonymous
          : SignatureType.V4
    };
    this.retrieved = true;
    return Promise.resolve(cred);
  }

  // IsExpired returns if the credentials have been retrieved.
  isExpired() {
    return !this.retrieved;
  }
}
