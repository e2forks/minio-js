/*
 * Minio Javascript Library for Amazon S3 Compatible Cloud Storage, (C) 2015 Minio, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import mime from "mime-types";
import stream, { Readable, Writable } from "stream";

interface IAnyFunction<A extends Array<any> = any[], R = any> {
  (...args: A): R;
}

export interface IIndexedObject {
  [index: string]: any;
}

// Returns a wrapper function that will promisify a given callback function.
// It will preserve 'this'.
export function promisify<R, F extends IAnyFunction>(
  fn: F
): IAnyFunction<Parameters<typeof fn>, ReturnType<typeof fn> | Promise<R>> {
  return function(...args: Parameters<typeof fn>) {
    // If the last argument is a function, assume its the callback.
    let callback = args[args.length - 1];

    // If the callback is given, don't promisify, just pass straight in.
    if (typeof callback === "function") return fn.apply(args);

    return new Promise((resolve, reject) => {
      // Add the callback function.
      args.push((err: Error, value: any) => {
        if (err) return reject(err);
        resolve(value);
      });

      // Call the function with our special adaptor callback added.
      fn.apply(args);
    });
  };
}

// All characters in string which are NOT unreserved should be percent encoded.
// Unreserved characers are : ALPHA / DIGIT / "-" / "." / "_" / "~"
// Reference https://tools.ietf.org/html/rfc3986#section-2.2
export function uriEscape(string: string) {
  return string.split("").reduce((acc, elem) => {
    let buf = new Buffer(elem);
    if (buf.length === 1) {
      // length 1 indicates that elem is not a unicode character.
      // Check if it is an unreserved characer.
      if (
        ("A" <= elem && elem <= "Z") ||
        ("a" <= elem && elem <= "z") ||
        ("0" <= elem && elem <= "9") ||
        elem === "_" ||
        elem === "." ||
        elem === "~" ||
        elem === "-"
      ) {
        // Unreserved characer should not be encoded.
        acc = acc + elem;
        return acc;
      }
    }
    // elem needs encoding - i.e elem should be encoded if it's not unreserved
    // character or if it's a unicode character.
    for (var i = 0; i < buf.length; i++) {
      acc = acc + "%" + buf[i].toString(16).toUpperCase();
    }
    return acc;
  }, "");
}

export function uriResourceEscape(string: string) {
  return uriEscape(string).replace(/%2F/g, "/");
}

export function getScope(region: string, date: Date) {
  return `${makeDateShort(date)}/${region}/s3/aws4_request`;
}

// isAmazonEndpoint - true if endpoint is 's3.amazonaws.com' or 's3.cn-north-1.amazonaws.com.cn'
export function isAmazonEndpoint(endpoint: string) {
  return (
    endpoint === "s3.amazonaws.com" ||
    endpoint === "s3.cn-north-1.amazonaws.com.cn"
  );
}

// isVirtualHostStyle - verify if bucket name is support with virtual
// hosts. bucketNames with periods should be always treated as path
// style if the protocol is 'https:', this is due to SSL wildcard
// limitation. For all other buckets and Amazon S3 endpoint we will
// default to virtual host style.
export function isVirtualHostStyle(
  endpoint: string,
  protocol: string,
  bucket: string
) {
  if (protocol === "https:" && bucket.indexOf(".") > -1) {
    return false;
  }
  return isAmazonEndpoint(endpoint);
}

var ipv4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;

export function isValidIP(ip: string) {
  return ipv4Regex.test(ip);
}

// isValidEndpoint - true if endpoint is valid domain.
export function isValidEndpoint(endpoint: string) {
  if (!isValidDomain(endpoint) && !isValidIP(endpoint)) {
    return false;
  }
  // Return true.
  return true;
}

// isValidDomain - true if input host is a valid domain.
export function isValidDomain(host: string) {
  if (!isString(host)) return false;
  // See RFC 1035, RFC 3696.
  if (host.length === 0 || host.length > 255) {
    return false;
  }
  // Host cannot start or end with a '-'
  if (host[0] === "-" || host.substr(-1) === "-") {
    return false;
  }
  // Host cannot start or end with a '_'
  if (host[0] === "_" || host.substr(-1) === "_") {
    return false;
  }
  // Host cannot start or end with a '.'
  if (host[0] === "." || host.substr(-1) === ".") {
    return false;
  }
  var alphaNumerics = "`~!@#$%^&*()+={}[]|\\\"';:><?/".split("");
  // All non alphanumeric characters are invalid.
  for (var i in alphaNumerics) {
    if (host.indexOf(alphaNumerics[i]) > -1) {
      return false;
    }
  }
  // No need to regexp match, since the list is non-exhaustive.
  // We let it be valid and fail later.
  return true;
}

// Probes contentType using file extensions.
// For example: probeContentType('file.png') returns 'image/png'.
export function probeContentType(path: string) {
  let contentType = mime.lookup(path);
  if (!contentType) {
    contentType = "application/octet-stream";
  }
  return contentType;
}

// isValidPort - is input port valid.
export function isValidPort<T>(port: T) {
  // verify if port is a number.
  if (!isNumber(port)) return false;
  // port cannot be negative.
  if (port < 0) return false;
  // port '0' is valid and special case return true.
  if (port === 0) return true;
  var min_port = 1;
  var max_port = 65535;
  // Verify if port is in range.
  return port >= min_port && port <= max_port;
}

export function isValidBucketName(bucket: string) {
  if (!isString(bucket)) return false;

  // bucket length should be less than and no more than 63
  // characters long.
  if (bucket.length < 3 || bucket.length > 63) {
    return false;
  }
  // bucket with successive periods is invalid.
  if (bucket.indexOf("..") > -1) {
    return false;
  }
  // bucket cannot have ip address style.
  if (bucket.match(/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/)) {
    return false;
  }
  // bucket should begin with alphabet/number and end with alphabet/number,
  // with alphabet/number/.- in the middle.
  if (bucket.match(/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/)) {
    return true;
  }
  return false;
}

// check if objectName is a valid object name
export function isValidObjectName(objectName: string) {
  if (!isValidPrefix(objectName)) return false;
  if (objectName.length === 0) return false;
  return true;
}

// check if prefix is valid
export function isValidPrefix(prefix: string) {
  if (!isString(prefix)) return false;
  if (prefix.length > 1024) return false;
  return true;
}

// check if typeof arg number
export function isNumber(arg: any): arg is number {
  return typeof arg === "number";
}

// check if typeof arg function
export function isFunction(arg: any): arg is Function {
  return typeof arg === "function";
}

// check if typeof arg string
export function isString(arg: any): arg is string {
  return typeof arg === "string";
}

// check if typeof arg object
export function isObject(arg: any): arg is Object {
  return typeof arg === "object" && arg !== null;
}

// check if object is readable stream
export function isReadableStream(arg: any): arg is Readable {
  return isObject(arg) && isFunction(arg._read);
}

// check if arg is boolean
export function isBoolean(arg: any): arg is boolean {
  return typeof arg === "boolean";
}

// check if arg is array
export function isArray(arg: any): arg is any[] {
  return Array.isArray(arg);
}

// check if arg is a valid date
export function isValidDate(arg: any): arg is Date {
  return arg instanceof Date && !isNaN(arg as any);
}

// Create a Date string with format:
// 'YYYYMMDDTHHmmss' + Z
export function makeDateLong(date: Date) {
  date = date || new Date();

  // Gives format like: '2017-08-07T16:28:59.889Z'
  const datestr = date.toISOString();

  return (
    datestr.substr(0, 4) +
    datestr.substr(5, 2) +
    datestr.substr(8, 5) +
    datestr.substr(14, 2) +
    datestr.substr(17, 2) +
    "Z"
  );
}

// Create a Date string with format:
// 'YYYYMMDD'
export function makeDateShort(date: Date) {
  date = date || new Date();

  // Gives format like: '2017-08-07T16:28:59.889Z'
  const datestr = date.toISOString();

  return datestr.substr(0, 4) + datestr.substr(5, 2) + datestr.substr(8, 2);
}

// pipesetup sets up pipe() from left to right os streams array
// pipesetup will also make sure that error emitted at any of the upstream Stream
// will be emitted at the last stream. This makes error handling simple
export function pipesetup(...streams: Writable[]) {
  return streams.reduce((src, dst) => {
    src.on("error", err => dst.emit("error", err));
    return src.pipe(dst);
  });
}

// return a Readable stream that emits data
export function readableStream<T>(data: T) {
  var s = new stream.Readable();
  s._read = () => {};
  s.push(data);
  s.push(null);
  return s;
}
// Function prepends metadata with the appropriate prefix if it is not already on
export function prependXAMZMeta<T extends IIndexedObject>(metaData: T): T {
  var newMetadata = Object.assign({}, metaData);
  for (var key in metaData) {
    if (
      !isAmzHeader(key) &&
      !isSupportedHeader(key) &&
      !isStorageclassHeader(key)
    ) {
      newMetadata["X-Amz-Meta-" + key] = newMetadata[key];
      delete newMetadata[key];
    }
  }
  return newMetadata;
}

// Checks if it is a valid header according to the AmazonS3 API
export function isAmzHeader(key: string) {
  var temp = key.toLowerCase();
  return (
    temp.startsWith("x-amz-meta-") ||
    temp === "x-amz-acl" ||
    temp.startsWith("x-amz-server-side-encryption-") ||
    temp === "x-amz-server-side-encryption"
  );
}
//Checks if it is a supported Header
export function isSupportedHeader(key: string) {
  var supported_headers = [
    "content-type",
    "cache-control",
    "content-encoding",
    "content-disposition",
    "content-language",
    "x-amz-website-redirect-location"
  ];
  return supported_headers.indexOf(key.toLowerCase()) > -1;
}
//Checks if it is a storage header
export function isStorageclassHeader(key: string) {
  return key.toLowerCase() === "x-amz-storage-class";
}

export function extractMetadata<
  R extends IIndexedObject = IIndexedObject,
  T extends IIndexedObject = IIndexedObject
>(metaData: T): R {
  var newMetadata: Partial<R> = {};
  for (var key in metaData) {
    if (
      isSupportedHeader(key) ||
      isStorageclassHeader(key) ||
      isAmzHeader(key)
    ) {
      if (key.toLowerCase().startsWith("x-amz-meta-")) {
        newMetadata[key.slice(11, key.length)] = metaData[key];
      } else {
        newMetadata[key] = metaData[key];
      }
    }
  }
  return newMetadata as R;
}
