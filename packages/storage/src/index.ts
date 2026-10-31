export {
  configFromEnv,
  createR2Client,
  getStorage,
  type Storage,
  type StorageConfig,
} from "./client";
export {
  DEFAULT_EXPIRES_IN,
  deleteObject,
  headObject,
  MAX_EXPIRES_IN,
  presignGet,
  presignGetStable,
  presignPut,
  putObject,
  STABLE_WINDOW,
  type ObjectInfo,
} from "./objects";
