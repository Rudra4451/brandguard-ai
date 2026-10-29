import { RuleSchema, RulebookSchema, type Rule } from './types';
import { canonicalJSON, sha256 } from './hasher';


export class RulebookStore {
  private rules: Map<string, Rule> = new Map();
  private versionHash: string = '';

  constructor(initialRules: Rule[] = []) {
    for (const rule of initialRules) {
      const parsed = RuleSchema.parse(rule);
      this.rules.set(parsed.id, parsed);
    }
  }

  public async getFullVersion(): Promise<string> {
    const sortedRules = this.list();
    const canonical = canonicalJSON({ rules: sortedRules });
    return sha256(canonical);
  }

  public async getVersion(): Promise<string> {
    const fullHash = await this.getFullVersion();
    this.versionHash = fullHash.slice(0, 12);
    return this.versionHash;
  }


  public list(): Rule[] {
    return Array.from(this.rules.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  public get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  public async create(rule: unknown): Promise<Rule> {
    const parsed = RuleSchema.parse(rule);
    if (this.rules.has(parsed.id)) {
      throw new Error(`Rule with ID '${parsed.id}' already exists.`);
    }
    this.rules.set(parsed.id, parsed);
    await this.getVersion();
    return parsed;
  }

  public async update(id: string, updates: Partial<Rule>): Promise<Rule> {
    const existing = this.rules.get(id);
    if (!existing) {
      throw new Error(`Rule with ID '${id}' not found.`);
    }
    const merged = { ...existing, ...updates, id };
    const validated = RuleSchema.parse(merged);
    this.rules.set(id, validated);
    await this.getVersion();
    return validated;
  }

  public async delete(id: string): Promise<boolean> {
    const existed = this.rules.delete(id);
    if (existed) {
      await this.getVersion();
    }
    return existed;
  }

  public exportJSON(): string {
    return JSON.stringify({ rules: this.list() }, null, 2);
  }

  public async importJSON(jsonStr: string): Promise<void> {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Malformed JSON string: ' + String(e));
    }

    const validated = RulebookSchema.parse(parsedJson);

    // Atomic replacement: if validation succeeds, update map
    const newMap = new Map<string, Rule>();
    for (const rule of validated.rules) {
      if (newMap.has(rule.id)) {
        throw new Error(`Duplicate rule ID in import: ${rule.id}`);
      }
      newMap.set(rule.id, rule);
    }

    this.rules = newMap;
    await this.getVersion();
  }
}
