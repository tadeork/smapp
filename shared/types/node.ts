import { HexString } from './misc';

export interface NodeVersionAndBuild {
  version: string;
  build: string;
}

export interface NodeStatus {
  connectedPeers: number;
  isSynced: boolean;
  syncedLayer: number;
  topLayer: number;
  verifiedLayer: number;
}

export enum NodeErrorLevel {
  LOG_LEVEL_UNSPECIFIED = 0,
  LOG_LEVEL_DEBUG = 1,
  LOG_LEVEL_INFO = 2,
  LOG_LEVEL_WARN = 3,
  LOG_LEVEL_ERROR = 4,
  LOG_LEVEL_DPANIC = 5,
  LOG_LEVEL_PANIC = 6,
  LOG_LEVEL_FATAL = 7,

  // Additional error level that is not represented in
  // GRPC API since it referencing to system errors,
  // that consequences into Node can not run at all
  LOG_LEVEL_SYSERROR = 8,
}

export interface NodeError {
  level: NodeErrorLevel;
  module: string;
  msg: string;
  stackTrace: string;
}

export interface NodeConfig {
  p2p: {
    'network-id': number;
    [k: string]: unknown;
  };
  main: {
    'genesis-time': string;
    'layer-duration-sec': number;
    'layers-per-epoch': number;
    [k: string]: unknown;
  };
  smeshing: {
    'smeshing-coinbase': HexString;
    'smeshing-opts': {
      'smeshing-opts-datadir': string;
      'smeshing-opts-numfiles': number;
      'smeshing-opts-numunits': number;
      'smeshing-opts-provider': number;
      'smeshing-opts-throttle': boolean;
    };
    'smeshing-start': boolean;
  };
  [k: string]: unknown;
}
