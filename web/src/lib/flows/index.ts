import type { FlowGraph, FlowPlatform } from './types';
import { ANDROID_FLOW, IOS_FLOW } from './mobileFlow';
import { WEB_FLOW } from './webFlow';

export * from './types';
export { WEB_FLOW } from './webFlow';
export { ANDROID_FLOW, IOS_FLOW } from './mobileFlow';

export function getFlowGraph(platform: FlowPlatform): FlowGraph {
  switch (platform) {
    case 'web':
      return WEB_FLOW;
    case 'android':
      return ANDROID_FLOW;
    case 'ios':
      return IOS_FLOW;
  }
}
