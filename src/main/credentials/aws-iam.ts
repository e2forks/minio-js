import http from "http";
import { join } from "path";
import { Expiry } from "./credentials";

// DefaultExpiryWindow - Default expiry window.
// ExpiryWindow will allow the credentials to trigger refreshing
// prior to the credentials actually expiring. This is beneficial
// so race conditions with expiring credentials do not cause
// request to fail unexpectedly due to ExpiredTokenException exceptions.
const DefaultExpiryWindow = 1000 * 10; // 10 secs

const defaultIAMRoleEndpoint = "http://169.254.169.254";
const defaultECSRoleEndpoint = "http://169.254.170.2";
const defaultIAMSecurityCredsPath =
  "/latest/meta-data/iam/security-credentials";

// A ec2RoleCredRespBody provides the shape for unmarshaling credential
// request responses.
interface IEc2RoleCredRespBody {
  // Success State
  Expiration: string;
  AccessKeyID: string;
  SecretAccessKey: string;
  Token: string;

  // Error state
  Code: string;
  Message: string;

  // Unused params.
  LastUpdated: string;
  Type: string;
}

export class IAMCredentials {
  constructor(
    public readonly endpoint: string,
    public readonly expiry = new Expiry()
  ) {}
  // Retrieve retrieves credentials from the EC2 service.
  // Error will be returned if the request fails, or unable to extract
  // the desired
  retrieve() {
    const { endpoint, isEcsTask } = getEndpoint(this.endpoint);
    const roleCreds = isEcsTask
      ? getEcsTaskCredentials(endpoint)
      : getCredentials(endpoint);

    roleCreds.then(cred => {
      // Expiry window is set to 10secs.
      this.expiry.setExpiration(
        new Date(cred.Expiration).getTime(),
        DefaultExpiryWindow
      );
      return {
        accessKey: cred.AccessKeyID,
        secretKey: cred.SecretAccessKey,
        sessionToken: cred.Token
      };
    });
  }
}

// https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
function getEndpoint(endpoint = "") {
  const { AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: ecsURI } = process.env;
  const isEcsTask = ecsURI !== "";

  if (endpoint !== "") {
    return { endpoint, isEcsTask };
  }
  if (isEcsTask) {
    return { endpoint: `${defaultECSRoleEndpoint}${ecsURI}`, isEcsTask };
  }
  return { endpoint: defaultIAMRoleEndpoint, isEcsTask: false };
}

// listRoleNames lists of credential role names associated
// with the current EC2 service. If there are no credentials,
// or there is an error making or receiving the request.
// http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html
function listRoleNames(url: string) {
  // - An instance profile can contain only one IAM role. This limit cannot be increased.
  return httpGet(url).then(body =>
    body.length > 0
      ? Promise.resolve(body)
      : Promise.reject("No IAM roles attached to this EC2 service")
  );
}

function getEcsTaskCredentials(
  endpoint: string
): Promise<IEc2RoleCredRespBody> {
  return httpGetJSON<IEc2RoleCredRespBody>(endpoint);
}

// getCredentials - obtains the credentials from the IAM role name associated with
// the current EC2 service.
//
// If the credentials cannot be found, or there is an error
// reading the response an error will be returned.
function getCredentials(endpoint: string): Promise<IEc2RoleCredRespBody> {
  // http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html
  return listRoleNames(join(endpoint, defaultIAMSecurityCredsPath)).then(
    rolename =>
      getEcsTaskCredentials(
        join(endpoint, defaultIAMSecurityCredsPath, rolename)
      )
  );
}

function httpGetJSON<T>(url: string): Promise<T> {
  return httpGet(url).then(body => {
    try {
      return JSON.parse(body);
    } catch (err) {
      return Promise.reject(err);
    }
  });
}

function httpGet(url: string) {
  return new Promise<string>((resolve, reject) => {
    http
      .get(url, res => {
        const { statusCode } = res;
        let error;
        if (statusCode !== 200) {
          error = new Error("Request Failed.\n" + `Status Code: ${statusCode}`);
        }
        if (error) {
          // consume response data to free up memory
          res.resume();
          reject(error);
          return;
        }
        res.setEncoding("utf8");
        let rawData = "";
        res.on("data", chunk => {
          rawData += chunk;
        });
        res.on("end", () => {
          resolve(String(rawData).trim());
        });
      })
      .on("error", e => {
        reject(e);
      });
  });
}
