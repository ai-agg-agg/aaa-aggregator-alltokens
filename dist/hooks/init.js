import { registry } from '@ai-agg-agg/aaa-sdk';
import { AlltokensAggregator } from '../index';
const hook = async function () {
    registry.registerAggregator(new AlltokensAggregator());
};
export default hook;
