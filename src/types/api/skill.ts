// ============================================
// Skill API Types
// 基于 OpenAPI 规范
// ============================================

export interface Skill {
  name: string
  description: string
  location: string
  content: string
}

export type SkillList = Skill[]
