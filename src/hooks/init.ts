import { Hook } from '@oclif/core'
import { registry } from '@ai-agg-agg/aaa-sdk'
import { AlltokensAggregator } from '../index'

const hook: Hook<'init'> = async function () {
  registry.registerAggregator(new AlltokensAggregator())
}

export default hook
