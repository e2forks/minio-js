import { IProvider, SignatureType } from ".";

// A EnvMinio retrieves credentials from the environment variables of the
// running process. EnvMinioironment credentials never expire.
//
// EnvMinioironment variables used:
//
// * Access Key ID:     MINIO_ACCESS_KEY.
// * Secret Access Key: MINIO_SECRET_KEY.
export class EnvMinio implements IProvider {
  retrieved: boolean = false;

  retrieve() {
    const { MINIO_ACCESS_KEY = "", MINIO_SECRET_KEY = "" } = process.env;
    const cred = {
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
      signerType:
        MINIO_ACCESS_KEY == "" || MINIO_SECRET_KEY == ""
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
