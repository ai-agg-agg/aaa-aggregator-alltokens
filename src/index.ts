import type { Aggregator, Model, AgentType } from '@ai-agg-agg/aaa-sdk'
import { httpGet, cacheSet, cacheGet, cacheStaleGet, isCacheFresh, resolveAuth, log } from '@ai-agg-agg/aaa-sdk'

const CACHE_KEY = 'alltokens/models'
const AGENT_TYPE_KEYWORDS: Record<string, RegExp> = {
  claude: /claude|anthropic/i,
  gpt: /gpt|openai|o\d/i,
}

export class AlltokensAggregator implements Aggregator {
  readonly name = 'alltokens'
  readonly apiBase: string

  constructor() {
    this.apiBase = process.env.ALLTOKENS_API_BASE ?? 'https://api.alltokens.ru/api/v1'
  }

  async auth(): Promise<string> {
    return resolveAuth(this.name, 'ALLTOKENS_API_KEY', `${Bun.env.HOME ?? '~'}/.authinfo.gpg`)
  }

  async fetchModels(): Promise<Model[]> {
    if (await isCacheFresh(CACHE_KEY)) {
      const cached = await cacheGet(CACHE_KEY)
      if (cached) return JSON.parse(cached) as Model[]
    }

    const token = await this.auth()
    try {
      const body = await httpGet(
        `${this.apiBase}/models`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const raw = JSON.parse(body)
      const items = (raw.data ?? raw) as Array<Record<string, unknown>>

      const models: Model[] = items.map((item) => {
        const pricing = item.pricing as Record<string, string> | undefined
        const tp = item.top_provider as Record<string, unknown> | undefined

        return {
          id: item.id as string,
          providers: [],
          top_provider: {
            name: item.id ? extractProvider(item.id as string) : '?',
            context_length: (tp?.context_length ?? item.context_length ?? 0) as number,
            max_completion_tokens: (tp?.max_completion_tokens ?? 0) as number,
            pricing: {
              prompt_per_million: parseFloat(pricing?.prompt ?? '0'),
              completion_per_million: parseFloat(pricing?.completion ?? '0'),
              currency: 'RUB',
            },
          },
          _aggregator: 'alltokens.ru',
        }
      })

      await cacheSet(CACHE_KEY, JSON.stringify(models))
      return models
    } catch {
      const stale = await cacheStaleGet(CACHE_KEY)
      if (stale) return JSON.parse(stale) as Model[]
      throw new Error('Failed to fetch alltokens.ru models')
    }
  }

  async getBalance(): Promise<number> {
    log.warn('alltokens.ru has no public balance endpoint — check alltokens.ru/dashboard')
    return 0
  }

  async getUsage(): Promise<string> {
    return '0'
  }

  filterModels(models: Model[], agentType: AgentType): Model[] {
    if (agentType === 'any') return models
    const regex = AGENT_TYPE_KEYWORDS[agentType]
    if (!regex) return models
    return models.filter(
      (m) => m.providers.some((p) => regex.test(p.name)) || regex.test(m.id),
    )
  }
}

function extractProvider(modelId: string): string {
  const parts = modelId.split('/')
  if (parts.length > 1) return parts[0]!
  if (/claude|anthropic/i.test(modelId)) return 'anthropic'
  if (/gpt|openai|o\d/i.test(modelId)) return 'openai'
  if (/gemini/i.test(modelId)) return 'google'
  if (/deepseek/i.test(modelId)) return 'deepseek'
  if (/qwen/i.test(modelId)) return 'alibaba'
  if (/kimi/i.test(modelId)) return 'moonshot'
  if (/grok/i.test(modelId)) return 'xai'
  if (/glm/i.test(modelId)) return 'zhipu'
  if (/minimax/i.test(modelId)) return 'minimax'
  if (/mimo/i.test(modelId)) return 'xiaomi'
  if (/llama|meta/i.test(modelId)) return 'meta'
  if (/mistral/i.test(modelId)) return 'mistral'
  return parts[0] ?? '?'
}
