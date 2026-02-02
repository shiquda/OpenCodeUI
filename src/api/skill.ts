// ============================================
// Skill API
// ============================================

import { get } from './http'
import { formatPathForApi } from '../utils/directoryUtils'
import type { SkillList } from '../types/api/skill'

/**
 * 获取所有可用 Skills
 */
export async function getSkills(directory?: string): Promise<SkillList> {
  return get<SkillList>('/skill', { directory: formatPathForApi(directory) })
}
